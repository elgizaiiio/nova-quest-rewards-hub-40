import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawEvent } from "@/lib/agentsky/client";

const mocks = vi.hoisted(() => ({ events: vi.fn(), send: vi.fn(), listener: null as null | ((e: RawEvent) => void), changed: null as null | ((id: string) => void) }));
vi.mock("@/lib/agentsky/client", () => ({
  agentApi: { events: mocks.events, send: mocks.send, requests: async () => ({ requests: [] }) },
  onSessionChanged: (fn: (id: string) => void) => { mocks.changed = fn; return () => {}; },
  openStream: (_id: string, fn: (e: RawEvent) => void, signal: AbortSignal) => {
    mocks.listener = fn;
    return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
  },
}));
import { useAgentSession } from "./useAgentSession";

describe("chat message continuity", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.events.mockResolvedValue({ events: [], status: "idle" }); });
  it("shows a sent message immediately and keeps it through a stale history reload", async () => {
    let finish: ((event: RawEvent) => void) | undefined;
    mocks.send.mockImplementation(() => new Promise<RawEvent>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useAgentSession("chat-1", "en"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.send("Keep this message"));
    expect(result.current.turns.filter((t) => t.type === "user").map((t) => t.text)).toEqual(["Keep this message"]);
    await act(async () => { mocks.changed?.("chat-1"); });
    expect(result.current.turns.filter((t) => t.type === "user").map((t) => t.text)).toEqual(["Keep this message"]);
    const saved: RawEvent = { id: "saved-1", type: "user.message", content: [{ type: "text", text: "Keep this message" }] };
    await act(async () => { finish?.(saved); });
    mocks.events.mockResolvedValue({ events: [saved], status: "idle" });
    await act(async () => { mocks.changed?.("chat-1"); });
    expect(result.current.turns.filter((t) => t.type === "user").map((t) => t.text)).toEqual(["Keep this message"]);
  });
});