/** Inngest calls this to run background jobs; every request is verified with the signing key by the SDK. */
import { createFileRoute } from "@tanstack/react-router";
import { serve } from "inngest/edge";
import { inngest, ceyoLongTask } from "@/lib/ceyo/inngest.server";

const handler = serve({ client: inngest, functions: [ceyoLongTask] });

export const Route = createFileRoute("/api/public/inngest")({
  server: { handlers: { GET: ({ request }) => handler(request), POST: ({ request }) => handler(request), PUT: ({ request }) => handler(request) } },
});
