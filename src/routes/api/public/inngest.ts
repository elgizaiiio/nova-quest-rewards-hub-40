import { createFileRoute } from "@tanstack/react-router";
async function handle(request: Request) {
  const [{ serve }, { createInngest, createLongTask }] = await Promise.all([import("inngest/edge"), import("@/lib/ceyo/inngest.server")]);
  const client = createInngest();
  const handler = serve({ client, functions: [createLongTask(client)], signingKey: process.env.INNGEST_SIGNING_KEY });
  return handler(request);
}
export const Route = createFileRoute("/api/public/inngest")({ server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request), PUT: ({ request }) => handle(request) } } });