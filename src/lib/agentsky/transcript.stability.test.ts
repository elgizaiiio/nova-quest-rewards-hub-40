import { describe, expect, it } from "vitest";
import { buildTranscript } from "./transcript";

describe("single active agent turn", () => {
  it("closes the earlier thinking segment when a user steers the same run", () => {
    const turns = buildTranscript([
      { id: "user1", type: "user.message", content: [{ type: "text", text: "Research" }] },
      { id: "run1", type: "session.status_running" },
      { id: "thought1", type: "agent.reasoning", part: { type: "reasoning", text: "Checking", stream_id: "r" } },
      { id: "user2", type: "user.message", content: [{ type: "text", text: "Actually stop" }] },
      { id: "thought2", type: "agent.reasoning", part: { type: "reasoning", text: "Adjusting", stream_id: "r2" } },
    ], "en", true);
    expect(turns.filter((t) => t.type === "agent" && t.running)).toHaveLength(1);
    expect(turns.filter((t) => t.type === "agent").flatMap((t) => t.type === "agent" ? t.steps.filter((s) => s.status === "active") : [])).toHaveLength(1);
  });
});