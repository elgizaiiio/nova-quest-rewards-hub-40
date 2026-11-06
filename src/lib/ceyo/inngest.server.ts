import { Inngest } from "inngest";
import { runAgentLoop } from "./agentLoop.server";

export function createInngest() {
  const signingKey = process.env.INNGEST_SIGNING_KEY;
  if (!signingKey) throw new Error("Background signing key is not configured");
  return new Inngest({ id: "ceyo", signingKey, eventKey: process.env.INNGEST_EVENT_KEY, isDev: false });
}
export function createLongTask(client: Inngest) {
  return client.createFunction({ id: "ceyo-long-task", retries: 1, triggers: [{ event: "ceyo/long.task" }] }, async ({ event, step }) => {
    const jobId = String(event.data.jobId || "");
    if (!/^[a-f0-9-]{36}$/i.test(jobId)) throw new Error("Invalid job");
    // This function is reached only through the SDK's signed handler.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const job = await step.run("load-job", async () => {
      const { data, error } = await supabaseAdmin.from("agent_jobs").select("*").eq("id", jobId).single();
      if (error || !data) throw new Error("Job not found");
      return data;
    });
    if (job.status === "cancelled" || job.status === "completed") return { text: job.result || "" };
    const text = await step.run("work", async () => {
      await supabaseAdmin.from("agent_jobs").update({ status: "running" }).eq("id", job.id);
      let cursor = job.cursor_at;
      const poll = async () => {
        const { data } = await supabaseAdmin.from("messages").select("content,created_at").eq("conversation_id", job.conversation_id).eq("user_id", job.user_id).eq("role", "user").gt("created_at", cursor).order("created_at");
        if (data?.length) cursor = data[data.length - 1].created_at;
        return (data || []).map((m) => m.content);
      };
      try {
        const output = await runAgentLoop(job.system_prompt + "\nComplete this background research or writing job and return the finished deliverable. No workspace or integration actions are available in this background job; do not claim them.", [{ role: "user", content: job.goal }], () => {}, new AbortController().signal, poll, { maxSteps: 25 });
        if (!output.trim()) throw new Error("No completed answer");
        return output;
      } catch (error) {
        await supabaseAdmin.from("agent_jobs").update({ status: "failed", error: "Background work failed" }).eq("id", job.id);
        throw error;
      }
    });
    await step.run("deliver-once", async () => {
      const { data: conversation } = await supabaseAdmin.from("conversations").select("id").eq("id", job.conversation_id).eq("user_id", job.user_id).maybeSingle();
      if (!conversation) throw new Error("Conversation no longer exists");
      const { error } = await supabaseAdmin.from("messages").upsert({ id: job.id, user_id: job.user_id, conversation_id: job.conversation_id, bot_id: job.bot_id, role: "assistant", content: text, metadata: { fromJob: job.id } }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("agent_jobs").update({ status: "completed", result: text }).eq("id", job.id);
      await supabaseAdmin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", job.conversation_id);
      return true;
    });
    return { text };
  });
}
export async function backgroundReady(): Promise<boolean> {
  const key = process.env.INNGEST_SIGNING_KEY;
  if (!key) return false;
  const url = `${process.env.APP_URL || "https://app.ceyo.si"}/api/public/inngest`;
  const response = await fetch("https://api.inngest.com/v2/apps/ceyo/syncs", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ url }),
  });
  if (!response.ok) { console.error(`Inngest sync unavailable [${response.status}]`); return false; }
  return true;
}
export async function startLongTask(payload: { system: string; goal: string; userId: string; conversationId: string; botId: string | null; cursorAt: string }): Promise<string> {
  const key = process.env.INNGEST_EVENT_KEY;
  if (!key) throw new Error("Background jobs are not configured");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conv } = await supabaseAdmin.from("conversations").select("id").eq("id", payload.conversationId).eq("user_id", payload.userId).maybeSingle();
  if (!conv) throw new Error("Conversation not found");
  const { data: job, error } = await supabaseAdmin.from("agent_jobs").insert({ user_id: payload.userId, conversation_id: payload.conversationId, bot_id: payload.botId, goal: payload.goal, system_prompt: payload.system, cursor_at: payload.cursorAt }).select("id").single();
  if (error || !job) throw new Error("Could not save job");
  // Existing direct Inngest event key; not a gateway connection key.
  const response = await fetch(`https://inn.gs/e/${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: job.id, name: "ceyo/long.task", data: { jobId: job.id } }) });
  if (!response.ok) { await supabaseAdmin.from("agent_jobs").update({ status: "failed" }).eq("id", job.id); throw new Error(`Could not start background work (${response.status})`); }
  const result = await response.json() as any;
  await supabaseAdmin.from("agent_jobs").update({ event_id: result.ids?.[0] || null }).eq("id", job.id);
  return job.id;
}