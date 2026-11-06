import { describe, expect, it } from "vitest";
import { groupInput, actionInput } from "./toolSchemas";
describe("workspace validation", () => {
  const a = "00000000-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";
  it("requires different bots for a team", () => {
    expect(groupInput.safeParse({ name: "Team", member_ids: [a, a] }).success).toBe(false);
    expect(groupInput.safeParse({ name: "Team", member_ids: [a, b] }).success).toBe(true);
  });
  it("requires an explicit integration account", () => {
    expect(actionInput.safeParse({ tool_slug: "GMAIL_SEND_EMAIL", arguments: {} }).success).toBe(false);
    expect(actionInput.safeParse({ account_id: "account-1", tool_slug: "GMAIL_SEND_EMAIL", arguments: {} }).success).toBe(true);
  });
});