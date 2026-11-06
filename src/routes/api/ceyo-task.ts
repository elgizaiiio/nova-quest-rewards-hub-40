/** Signed-in check of a background job; when it finishes, its result is posted into the chat once. */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/api/supabaseServerConfig";
import { longTaskStatus } from "@/lib/ceyo/trigger.server";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/ceyo-task")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return json({ error: "unauthorized" }, 401);
        const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: u } = await db.auth.getUser(token);
        if (!u.user) return json({ error: "unauthorized" }, 401);
        const { messageId } = await request.json().catch(() => ({}));
        const { data: m } = await db.from("messages").select("id, conversation_id, bot_id, metadata").eq("id", String(messageId ?? "")).maybeSingle();
        const meta = (m?.metadata ?? {}) as Record<string, any>;
        if (!m || !meta.pendingRun || meta.done !== "false") return json({ done: true, posted: false });
        const st = await longTaskStatus(meta.pendingRun).catch(() => null);
        if (!st?.done) return json({ done: false });
        // Claim first so two tabs cannot post the same result twice.
        const { data: claimed } = await db.from("messages").update({ metadata: { ...meta, done: "true" } as never })
          .eq("id", m.id).eq("metadata->>done", "false").select("id");
        if (!claimed?.length) return json({ done: true, posted: false });
        await db.from("messages").insert({
          conversation_id: m.conversation_id, user_id: u.user.id, role: "assistant", bot_id: m.bot_id,
          content: st.ok && st.text ? st.text : "ugh, that one didn't work out on my side 😕 want me to try again?",
          metadata: { fromRun: meta.pendingRun } as never,
        });
        await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", m.conversation_id);
        return json({ done: true, posted: true, conversationId: m.conversation_id });
      },
    },
  },
});
