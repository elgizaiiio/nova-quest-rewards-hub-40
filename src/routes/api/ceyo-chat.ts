/** Signed-in bot reply: loads the conversation, runs the Cerebras + browser loop, streams events and saves the answer. */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/api/supabaseServerConfig";
import { runAgentLoop, type LoopEvent } from "@/lib/ceyo/agentLoop.server";

export const Route = createFileRoute("/api/ceyo-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: u } = await db.auth.getUser(token);
        if (!u.user) return new Response("Unauthorized", { status: 401 });
        const body = await request.json().catch(() => ({}));
        const conversationId = String(body?.conversationId ?? "");
        const { data: conv } = await db.from("conversations").select("id, bot_id").eq("id", conversationId).maybeSingle();
        if (!conv) return new Response("Not found", { status: 404 });
        const { data: bot } = conv.bot_id
          ? await db.from("bots").select("id, name, instructions").eq("id", conv.bot_id).maybeSingle()
          : { data: null };
        const { data: rows } = await db.from("messages").select("role, content, created_at").eq("conversation_id", conv.id)
          .order("created_at", { ascending: false }).limit(30);
        const history = (rows ?? []).reverse().filter((m) => m.content).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user", content: m.content,
        }));
        let lastSeen = rows?.[0]?.created_at ?? new Date(0).toISOString();
        const poll = async () => {
          const { data } = await db.from("messages").select("content, created_at").eq("conversation_id", conv.id)
            .eq("role", "user").gt("created_at", lastSeen).order("created_at");
          if (data?.length) lastSeen = data[data.length - 1].created_at;
          return (data ?? []).map((m) => m.content).filter(Boolean);
        };
        const system = [
          `Your name is ${bot?.name || "Sam"}. You are the user's close friend chatting with them in a messaging app.`,
          bot?.instructions ? `About you:\n${bot.instructions}` : "",
          [
            "How you talk:",
            "- Talk like a real friend texting: warm, casual, short. Usually 1-3 sentences.",
            "- Reply in the exact language and dialect the user writes in (e.g. Egyptian Arabic stays Egyptian).",
            "- Never say you are an AI, a model, an assistant or a bot, and never mention tools, searching or browsing. Just know things.",
            "- No headings, no bullet lists, no bold, no formal phrases like 'Certainly!' or 'I'd be happy to help'. Plain chat text only, unless they ask for code or a list.",
            "- An emoji now and then is fine, never forced. Ask a short follow-up question when it feels natural.",
            "- If the user sends new messages while you are working, adjust to them right away. If they tell you to stop or drop it, stop and reply with a quick casual ok.",
            "- Use web_search and read_url silently whenever fresh or outside facts help.",
            "Today is " + new Date().toDateString() + ".",
          ].join("\n"),
        ].filter(Boolean).join("\n\n");

        const enc = new TextEncoder();
        const events: LoopEvent[] = [];
        const stream = new ReadableStream({
          async start(ctl) {
            const emit = (e: LoopEvent) => {
              if (e.type !== "agent.reasoning") events.push(e);
              try { ctl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { /* client left */ }
            };
            const rid = crypto.randomUUID();
            emit({ id: `${rid}-run`, type: "session.status_running" });
            let text = "";
            let failed = "";
            try {
              text = await runAgentLoop(system, history, emit, request.signal, poll);
            } catch (e) {
              failed = e instanceof Error ? e.message : "Something went wrong";
              if (!request.signal.aborted) emit({ id: `${rid}-err`, type: "session.error", message: failed });
            }
            if (text || !failed) {
              await db.from("messages").insert({
                conversation_id: conv.id, user_id: u.user!.id, role: "assistant", bot_id: conv.bot_id,
                content: text.trim(), metadata: { events: events.filter((x) => x.type.startsWith("agent.tool")) } as never,
              });
              await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv.id);
            }
            emit({ id: `${rid}-idle`, type: "session.status_idle", stop_reason: { type: request.signal.aborted ? "interrupted" : "end_turn" } });
            try { ctl.close(); } catch { /* closed */ }
          },
        });
        return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
      },
    },
  },
});
