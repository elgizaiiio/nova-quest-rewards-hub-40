/** @doc Trigger.dev bridge for long background jobs; the production run key is read with the account token and cached. */
const API = "https://api.trigger.dev";
const PROJECT = "proj_gjletnuysqxuhtphdtgq";
let cachedKey: string | null = null;

async function runKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const pat = process.env.TRIGGER_ACCESS_TOKEN;
  if (!pat) throw new Error("Background jobs are not configured");
  const r = await fetch(`${API}/api/v1/projects/${PROJECT}/prod`, { headers: { Authorization: `Bearer ${pat}` } });
  if (!r.ok) throw new Error(`Background jobs unavailable (${r.status})`);
  cachedKey = String(((await r.json()) as any).apiKey);
  return cachedKey;
}

export async function startLongTask(payload: { system: string; goal: string }): Promise<string> {
  const r = await fetch(`${API}/api/v1/tasks/ceyo-long-task/trigger`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await runKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!r.ok) throw new Error(`Could not start job (${r.status})`);
  return String(((await r.json()) as any).id);
}

export async function longTaskStatus(runId: string): Promise<{ done: boolean; ok: boolean; text: string }> {
  const r = await fetch(`${API}/api/v3/runs/${encodeURIComponent(runId)}`, { headers: { Authorization: `Bearer ${await runKey()}` } });
  if (!r.ok) throw new Error(`Job status unavailable (${r.status})`);
  const j: any = await r.json();
  const status = String(j.status);
  if (status === "COMPLETED") return { done: true, ok: true, text: String(j.output?.text ?? "") };
  if (["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"].includes(status)) return { done: true, ok: false, text: "" };
  return { done: false, ok: false, text: "" };
}
