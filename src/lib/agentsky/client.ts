/** @doc Browser client for /api/agent/* — the only way the UI talks to the AgentSky agent. */
import { supabase } from "@/integrations/supabase/client";
import { readEventStream } from "./readEventStream";

export type AgentColor = "aurora" | "ocean" | "ember" | "mint" | "sun" | "rose" | "mono";

export type AgentInfo = {
  id: string;
  name: string;
  description: string;
  color: AgentColor;
  prompt: string;
  isDefault: boolean;
  isTemplate?: boolean;
  mediaOnly?: boolean;
  createdAt: string;
};

export type MediaModelInfo = {
  id: string;
  kind: "image" | "video";
  label: string;
  tier: "free" | "pro";
  locked: boolean;
};

export type SessionInfo = {
  id: string;
  agentId: string;
  title: string;
  status: string;
  createdAt: string;
};

export type AgentRequest = {
  id: string;
  session_id: string;
  kind: "question" | "approval" | "connect_app";
  subject: string | null;
  question: string;
  options: { id: string; label: string; description?: string }[];
  allow_free_text: boolean;
};

export class AgentApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const db = supabase as any;
const COLORS: AgentColor[] = ["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"];

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new AgentApiError(401, "unauthorized", "Sign in required");
  return id;
}
function fail(error: any): never {
  throw new AgentApiError(500, error?.code || "error", error?.message || "Request failed");
}
function toAgent(b: any, primary: string | null): AgentInfo {
  const color = COLORS.includes(b.look?.color) ? b.look.color : "aurora";
  return { id: b.id, name: b.name, description: b.description || "", color, prompt: b.instructions || "", isDefault: b.id === primary, createdAt: b.created_at };
}
const toSession = (c: any): SessionInfo => ({ id: c.id, agentId: c.bot_id || "", title: c.title || "New chat", status: running.has(c.id) ? "running" : "idle", createdAt: c.created_at });

/* Live replies: one in-flight request per conversation, with buffered events for late subscribers. */
type Live = { ctl: AbortController; events: RawEvent[]; subs: Set<(e: RawEvent) => void> };
const running = new Map<string, Live>();

async function startReply(sessionId: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AgentApiError(401, "unauthorized", "Sign in required");
  running.get(sessionId)?.ctl.abort();
  const live: Live = { ctl: new AbortController(), events: [], subs: new Set() };
  running.set(sessionId, live);
  const push = (e: RawEvent) => { live.events.push(e); live.subs.forEach((f) => f(e)); };
  void (async () => {
    try {
      const res = await fetch("/api/ceyo-chat", {
        method: "POST",
        signal: live.ctl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: sessionId }),
      });
      if (!res.ok || !res.body) throw new Error(`Reply failed (${res.status})`);
      await readEventStream(res.body, (e) => { push(e); });
    } catch (e: any) {
      if (live.ctl.signal.aborted) push({ id: crypto.randomUUID(), type: "session.status_idle", stop_reason: { type: "interrupted" } });
      else push({ id: crypto.randomUUID(), type: "session.error", message: e?.message } as RawEvent);
    } finally {
      if (running.get(sessionId) === live) running.delete(sessionId);
    }
    // A message sent in the last moment of a run may have missed it: answer it now.
    if (!live.ctl.signal.aborted && !running.has(sessionId)) {
      const { data: last } = await db.from("messages").select("role").eq("conversation_id", sessionId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last?.role === "user") void startReply(sessionId);
    }
  })();
}

async function addUserMessage(sessionId: string, text: string, images: string[] = [], messageId: string = crypto.randomUUID()) {
  const user = await uid();
  const { data, error } = await db.from("messages").insert({ id: messageId, conversation_id: sessionId, user_id: user, role: "user", content: text, metadata: { images } }).select("id, created_at").single();
  if (error) fail(error);
  const live = running.get(sessionId);
  const e: RawEvent = { id: data.id, type: "user.message", at: data.created_at, content: [{ type: "text", text }, ...images.map((url) => ({ type: "image", source: { type: "url", url } }))] };
  if (live) {
    // The bot is still working: it reads this message mid-run and changes course.
    live.events.push(e);
    live.subs.forEach((f) => f(e));
    return e;
  }
  await startReply(sessionId);
  return e;
}

/* Background jobs: check unfinished ones and tell open chats when a result lands. */
const changeSubs = new Set<(sessionId: string) => void>();
export function onSessionChanged(fn: (sessionId: string) => void) {
  changeSubs.add(fn);
  return () => { changeSubs.delete(fn); };
}
let polling = false;
async function checkBackgroundJobs() {
  if (polling) return;
  polling = true;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const { data: rows } = await db.from("messages").select("id").eq("role", "assistant").eq("metadata->>done", "false").limit(10);
    for (const r of rows ?? []) {
      const res = await fetch("/api/ceyo-task", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ messageId: r.id }) });
      const j = await res.json().catch(() => ({}));
      if (j?.posted && j.conversationId) changeSubs.forEach((f) => f(j.conversationId));
    }
  } catch { /* try again next tick */ } finally { polling = false; }
}
if (typeof window !== "undefined") setInterval(() => void checkBackgroundJobs(), 10000);

const agentInput = (a: { name: string; description: string; prompt: string; color: AgentColor }) => ({ name: a.name, description: a.description, instructions: a.prompt, look: { color: a.color } });

export const agentApi = {
  bootstrap: async () => {
    const user = await uid();
    const [{ data: bots, error }, { data: prof }] = await Promise.all([
      db.from("bots").select("*").eq("owner_id", user).order("created_at"),
      db.from("profiles").select("primary_bot_id").eq("id", user).maybeSingle(),
    ]);
    if (error) fail(error);
    const primary = prof?.primary_bot_id ?? null;
    return { agents: (bots ?? []).map((b: any) => toAgent(b, primary)), tier: "free" as const, models: [] as MediaModelInfo[] };
  },
  groups: async () => {
    const user = await uid();
    const { data, error } = await db.from("bot_groups").select("*,bot_group_members(bot_id,position)").eq("owner_id", user).order("created_at");
    if (error) fail(error);
    return (data ?? []).filter((g: any) => g.coordinator_id).map((g: any) => ({ id: g.id, name: g.name, coordinatorId: g.coordinator_id, category: g.category, createdAt: g.created_at, memberIds: (g.bot_group_members || []).sort((a: any, b: any) => a.position - b.position).map((m: any) => m.bot_id) }));
  },
  saveGroup: async (g: { id?: string; name: string; coordinatorId: string; memberIds: string[]; category: string }) => {
    const { data, error } = await db.rpc("save_bot_group", { p_name: g.name, p_coordinator: g.coordinatorId, p_members: g.memberIds, p_category: g.category, p_id: g.id?.startsWith("group-") ? null : g.id || null });
    if (error) fail(error);
    return { ...g, id: data.id, createdAt: data.created_at };
  },
  createAgent: async (a: { name: string; description: string; prompt: string; color: AgentColor }) => {
    const user = await uid();
    const { data, error } = await db.from("bots").insert({ owner_id: user, ...agentInput(a) }).select("*").single();
    if (error) fail(error);
    return { agent: toAgent(data, null) };
  },
  updateAgent: async (id: string, a: { name: string; description: string; prompt: string; color: AgentColor }) => {
    const { data, error } = await db.from("bots").update(agentInput(a)).eq("id", id).select("*").single();
    if (error) fail(error);
    return { agent: toAgent(data, null) };
  },
  deleteAgent: async (id: string) => {
    const { error } = await db.from("bots").delete().eq("id", id);
    if (error) fail(error);
    return {};
  },
  sessions: async () => {
    const user = await uid();
    const { data, error } = await db.from("conversations").select("*").eq("user_id", user).eq("is_hidden", false).order("updated_at", { ascending: false }).limit(100);
    if (error) fail(error);
    return { sessions: (data ?? []).map(toSession) };
  },
  createSession: async (p: { agentId?: string; text: string; images?: string[]; messageId?: string }) => {
    const user = await uid();
    const { data: group } = await db.from("bot_groups").select("id").eq("owner_id", user).eq("coordinator_id", p.agentId || "").maybeSingle();
    const { data, error } = await db.from("conversations").insert({ user_id: user, bot_id: p.agentId || null, group_id: group?.id || null, title: p.text.slice(0, 60) || "New chat" }).select("*").single();
    if (error) fail(error);
    await addUserMessage(data.id, p.text, p.images, p.messageId);
    return { session: { ...toSession(data), status: "running" } as SessionInfo };
  },
  session: async (id: string) => {
    const { data, error } = await db.from("conversations").select("*").eq("id", id).single();
    if (error) fail(error);
    return { session: toSession(data) };
  },
  renameSession: async (id: string, title: string) => {
    const { error } = await db.from("conversations").update({ title }).eq("id", id);
    if (error) fail(error);
    return {};
  },
  deleteSession: async (id: string) => {
    const { error } = await db.from("conversations").delete().eq("id", id);
    if (error) fail(error);
    return {};
  },
  events: async (id: string) => {
    const { data, error } = await db.from("messages").select("*").eq("conversation_id", id).order("created_at");
    if (error) fail(error);
    const events: RawEvent[] = [];
    const embeddedUsers = new Set((data || []).flatMap((m: any) => (m.metadata?.transcript || []).filter((e: RawEvent) => e.type === "user.message").map((e: RawEvent) => e.id)));
    for (const m of data ?? []) {
      if (m.role === "user") {
        if (embeddedUsers.has(m.id)) continue;
        const imgs: string[] = Array.isArray(m.metadata?.images) ? m.metadata.images : [];
        events.push({ id: m.id, type: "user.message", at: m.created_at, content: [{ type: "text", text: m.content }, ...imgs.map((url) => ({ type: "image", source: { type: "url", url } }))] });
      } else {
        if (Array.isArray(m.metadata?.transcript)) {
          events.push(...m.metadata.transcript);
          events.push({ id: m.id + "-idle", type: "session.status_idle", stop_reason: { type: "end_turn" } });
          continue;
        }
        events.push({ id: m.id + "-run", type: "session.status_running" });
        for (const e of (m.metadata?.events ?? []) as RawEvent[]) events.push({ ...e, id: m.id + e.id });
        events.push({ id: m.id + "-t", type: "agent.message", parts: [{ type: "text", text: m.content, stream_id: m.id }] });
        events.push({ id: m.id + "-idle", type: "session.status_idle", stop_reason: { type: "end_turn" } });
      }
    }
    const live = running.get(id);
    const ids = new Set(events.map((event) => event.id));
    return { events: [...events, ...(live?.events || []).filter((event) => !ids.has(event.id))], status: live ? "running" : "idle" };
  },
  send: (id: string, text: string, images?: string[], messageId?: string) => addUserMessage(id, text, images, messageId),
  interrupt: async (id: string) => {
    running.get(id)?.ctl.abort();
    return { status: "idle" };
  },
  requests: async (_id: string) => ({ requests: [] as AgentRequest[], sessions: [] as any[] }),
  tasks: async () => ({ tasks: [] as { id: string; agentId: string; title: string | null; attention: string; statusLine: string | null; openRequests: number; helpers: number; lastActivityAt: string }[] }),
  taskSessions: async (_id: string) => ({ sessions: [] as { id: string }[] }),
  media: async (_p: { kind: "image" | "video"; prompt: string; aspect?: string; duration?: number; model?: string; idempotencyKey?: string }): Promise<{ runId: string; token: string; model: string; status: string }> => {
    throw new AgentApiError(501, "unavailable", "Image and video creation is coming soon.");
  },
};

export async function mediaStatus(_runId: string, _token: string) {
  return { status: "failed", urls: [] as string[], error: "Unavailable" };
}

/* ---------------- events ---------------- */

export type RawEvent = {
  id: string;
  type: string;
  at?: string;
  parts?: any[];
  part?: any;
  content?: any[];
  text?: string;
  stop_reason?: { type: string };
};

/** Subscribes to a conversation's live reply; stays open (idle) until aborted. */
export async function openStream(sessionId: string, onEvent: (e: RawEvent) => boolean | void, signal: AbortSignal) {
  await new Promise<void>((resolve) => {
    let attached: Live | null = null;
    const listener = (e: RawEvent) => { onEvent(e); };
    const tick = () => {
      const live = running.get(sessionId) ?? null;
      if (live && live !== attached) {
        attached?.subs.delete(listener);
        attached = live;
        live.events.forEach((e) => onEvent(e));
        live.subs.add(listener);
      }
    };
    tick();
    const t = setInterval(tick, 150);
    signal.addEventListener("abort", () => { clearInterval(t); attached?.subs.delete(listener); resolve(); });
  });
}
