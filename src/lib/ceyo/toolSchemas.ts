import { z } from "zod";

export const botInput = z.object({ name: z.string().trim().min(1).max(60), description: z.string().max(500).default(""), instructions: z.string().min(1).max(6000), color: z.enum(["aurora", "ocean", "ember", "mint", "sun", "rose", "mono"]).default("mint") });
export const groupInput = z.object({ name: z.string().trim().min(2).max(60), member_ids: z.array(z.string().uuid()).min(2).max(8).refine((ids) => new Set(ids).size === ids.length), category: z.string().max(60).default("Unassigned") });
export const delegationInput = z.object({ bot_id: z.string().uuid(), task: z.string().min(1).max(6000), group_id: z.string().uuid().optional() });
export const actionInput = z.object({ account_id: z.string().min(1).max(200), tool_slug: z.string().regex(/^[A-Z0-9_]+$/).max(200), arguments: z.record(z.unknown()).refine((v) => JSON.stringify(v).length <= 24000) });
export type AgentTool = { name: string; def: object; run: (args: unknown) => Promise<string> };
export function tool(name: string, description: string, properties: object = {}, required: string[] = []): object {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}