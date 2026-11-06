/** @doc Inngest bridge for long background jobs: send an event, Inngest calls /api/public/inngest to run it, status is read by event id. */
import { Inngest } from "inngest";
import { runAgentLoop } from "@/lib/ceyo/agentLoop.server";

export const inngest = new Inngest({ id: "ceyo" });

export const ceyoLongTask = inngest.createFunction(
  { id: "ceyo-long-task", retries: 1, triggers: [{ event: "ceyo/long.task" }] },
  async ({ event, step }) => {
    const p = event.data as { system: string; goal: string };
    const text = await step.run("work", async () => {
      const system = p.system + "\n\nYou are doing a longer job in the background. Work step by step with your tools until it is fully done, then send your friend the final result in your usual casual style.";
      const out = await runAgentLoop(system, [{ role: "user", content: p.goal }], () => {}, new AbortController().signal, async () => [], { maxSteps: 30 });
      return out.trim();
    });
    return { text };
  },
);

export async function startLongTask(payload: { system: string; goal: string }): Promise<string> {
  const key = process.env.INNGEST_EVENT_KEY;
  if (!key) throw new Error("Background jobs are not configured");
  const r = await fetch(`https://inn.gs/e/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "ceyo/long.task", data: payload }),
  });
  if (!r.ok) throw new Error(`Could not start job (${r.status})`);
  const id = ((await r.json()) as any).ids?.[0];
  if (!id) throw new Error("Could not start job");
  return String(id);
}

export async function longTaskStatus(eventId: string): Promise<{ done: boolean; ok: boolean; text: string }> {
  const r = await fetch(`https://api.inngest.com/v1/events/${encodeURIComponent(eventId)}/runs`, {
    headers: { Authorization: `Bearer ${process.env.INNGEST_SIGNING_KEY}` },
  });
  if (!r.ok) throw new Error(`Job status unavailable (${r.status})`);
  const run = (((await r.json()) as any).data ?? [])[0];
  if (!run) return { done: false, ok: false, text: "" };
  const s = String(run.status);
  if (s === "Completed") return { done: true, ok: true, text: String(run.output?.text ?? "") };
  if (s === "Failed" || s === "Cancelled") return { done: true, ok: false, text: "" };
  return { done: false, ok: false, text: "" };
}
