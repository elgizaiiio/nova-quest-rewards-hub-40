import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/ceyo-chat")({ server: { handlers: {
  POST: async ({ request }) => {
    const { authenticate } = await import("@/lib/ceyo/auth.server");
    const auth = await authenticate(request).catch(() => null);
    if (!auth) return new Response("Unauthorized", { status: 401 });
    const input = z.object({ conversationId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!input.success) return new Response("Invalid conversation", { status: 400 });
    const { db, userId } = auth;
    const { data: conv } = await db.from("conversations").select("id,bot_id,group_id").eq("id", input.data.conversationId).eq("user_id", userId).maybeSingle();
    if (!conv) return new Response("Not found", { status: 404 });
    const [{ data: bot }, { data: profile }, { data: rows }] = await Promise.all([
      conv.bot_id ? db.from("bots").select("id,name,instructions").eq("id", conv.bot_id).eq("owner_id", userId).maybeSingle() : Promise.resolve({ data: null }),
      db.from("profiles").select("primary_bot_id").eq("id", userId).maybeSingle(),
      db.from("messages").select("role,content,created_at").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(30),
    ]);
    const cursor = rows?.[0]?.created_at || new Date(0).toISOString();
    let lastSeen = cursor;
    let onSteer: ((event: import("@/lib/ceyo/agentLoop.server").LoopEvent) => void) | undefined;
    const history = [...(rows || [])].reverse().filter((m) => m.content).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    const poll = async () => {
      const { data, error } = await db.from("messages").select("id,content,created_at").eq("conversation_id", conv.id).eq("role", "user").gt("created_at", lastSeen).order("created_at");
      if (error) throw new Error(error.message);
      if (data?.length) lastSeen = data[data.length - 1].created_at;
      for (const message of data || []) onSteer?.({ id: message.id, type: "user.message", at: message.created_at, content: [{ type: "text", text: message.content }] });
      return (data || []).map((m) => m.content);
    };
    const [{ runAgentLoop }, { workspaceTools }, { agentPrompt }, { startLongTask, backgroundReady }] = await Promise.all([
      import("@/lib/ceyo/agentLoop.server"), import("@/lib/ceyo/workspaceTools.server"), import("@/lib/ceyo/prompt"), import("@/lib/ceyo/inngest.server"),
    ]);
    const primary = profile?.primary_bot_id === conv.bot_id;
    const system = agentPrompt(bot?.name || "Sam", bot?.instructions || "", primary);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({ async start(controller) {
      const rid = crypto.randomUUID();
      const events: import("@/lib/ceyo/agentLoop.server").LoopEvent[] = [];
      const emit = (e: import("@/lib/ceyo/agentLoop.server").LoopEvent) => {
        if (e.type !== "agent.reasoning") events.push(e);
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { /* closed */ }
      };
      onSteer = emit;
      emit({ id: `${rid}-run`, type: "session.status_running" });
      try {
        const tools = workspaceTools({ db, userId, botId: conv.bot_id, conversationId: conv.id, primary, emit, signal: request.signal, poll });
        tools.push({ name: "start_long_task", def: { type: "function", function: { name: "start_long_task", description: "Run a long job in the background if the app is synchronized, otherwise execute it here.", parameters: { type: "object", properties: { goal: { type: "string" } }, required: ["goal"] } } }, run: async (args: unknown) => {
          const { goal } = z.object({ goal: z.string().min(1).max(4000) }).parse(args);
          try {
            if (await backgroundReady()) {
              const id = await startLongTask({ system, goal, userId, conversationId: conv.id, botId: conv.bot_id, cursorAt: lastSeen });
              return `Background job started (${id}); the result will be saved to this chat.`;
            }
          } catch { console.error("Background start unavailable; continuing inline"); }
          return runAgentLoop(system, [{ role: "user", content: goal }], emit, request.signal, poll, { maxSteps: 20, extras: tools.filter((t) => t.name !== "start_long_task") });
        } });
        const text = await runAgentLoop(system, history, emit, request.signal, poll, { extras: tools, maxSteps: 12 });
        if (!text.trim() && !events.some((e) => e.type === "agent.tool_result")) throw new Error("No answer was completed. Please try again.");
        const { error } = await db.from("messages").insert({ id: rid, conversation_id: conv.id, user_id: userId, bot_id: conv.bot_id, role: "assistant", content: text.trim(), metadata: { events: events.filter((e) => e.type.startsWith("agent.tool")), transcript: events } as never });
        if (error) throw new Error(error.message);
        await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);
      } catch (error) {
        if (!request.signal.aborted) emit({ id: `${rid}-error`, type: "session.error", message: error instanceof Error ? error.message : "Could not finish" });
      }
      emit({ id: `${rid}-idle`, type: "session.status_idle", stop_reason: { type: request.signal.aborted ? "interrupted" : "end_turn" } });
      try { controller.close(); } catch { /* closed */ }
    } });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
  },
} } });