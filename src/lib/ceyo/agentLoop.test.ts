import { afterEach, describe, expect, it, vi } from "vitest";
import { runAgentLoop } from "./agentLoop.server";
function reply(delta: object) { return new Response(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`); }
describe("steerable execution", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("does not execute a stale command when the user asks to stop", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "test-only");
    const run = vi.fn(async () => "created");
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ tool_calls: [{ index: 0, id: "call-1", function: { name: "create_bot", arguments: "{}" } }] })).mockResolvedValueOnce(reply({ content: "Stopped." }));
    vi.stubGlobal("fetch", fetcher);
    const poll = vi.fn().mockResolvedValueOnce(["Stop, don't create anything"]).mockResolvedValue([]);
    const result = await runAgentLoop("Partner", [{ role: "user", content: "Create a bot" }], () => {}, new AbortController().signal, poll, { extras: [{ name: "create_bot", def: { type: "function", function: { name: "create_bot", parameters: { type: "object", properties: {} } } }, run }] });
    expect(run).not.toHaveBeenCalled();
    expect(result).toBe("Stopped.");
    const request = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(request.messages.filter((m: any) => m.content === "Stop, don't create anything")).toHaveLength(1);
  });
});