/** Ceyo legal documents — the full policy text rendered on a clean black page. */
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft } from "lucide-react";
import botTermsMd from "@/content/bot-terms.md?raw";
import privacyMd from "@/content/privacy.md?raw";
import subscriptionTermsMd from "@/content/subscription-terms.md?raw";
import "@/styles/ceyo.css";

export type LegalSlug = "terms" | "privacy" | "subscription-terms";

export const LEGAL_DOCS: Record<LegalSlug, { title: string; description: string; source: string }> = {
  terms: {
    title: "Terms of Service",
    description: "The terms that apply when you use Ceyo and its Bots, including agentic actions, connected services and account rules.",
    source: botTermsMd,
  },
  privacy: {
    title: "Privacy Policy",
    description: "How Ceyo collects, uses, shares and protects your personal information across the app and the Bots you run.",
    source: privacyMd,
  },
  "subscription-terms": {
    title: "Subscription Terms of Service",
    description: "The agreement that covers your Ceyo subscription: plans, billing, renewals, cancellation, refunds and usage rules.",
    source: subscriptionTermsMd,
  },
};

/** Markdown body with internal links kept inside the app router. */
export function DocMarkdown({ source }: { source: string }) {
  return (
    <div className="cx-md" data-no-translate>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href && href.startsWith("/") ? (
              <Link to={href}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
        }}
      >
        {source}
      </Markdown>
    </div>
  );
}

export default function LegalDocPage({ slug }: { slug: LegalSlug }) {
  const doc = LEGAL_DOCS[slug];
  const nav = useNavigate();

  useEffect(() => {
    document.title = `${doc.title} | Ceyo`;
  }, [doc.title]);

  return (
    <div className="agent-hub ceyo-page" data-no-translate>
      <header className="ceyo-top">
        <button type="button" className="gx-round" aria-label="Back" onClick={() => nav("/")}>
          <ChevronLeft size={20} />
        </button>
        <h1>{doc.title}</h1>
        <span className="ceyo-top-action" />
      </header>
      <div className="ceyo-scroll">
        <DocMarkdown source={doc.source} />
      </div>
    </div>
  );
}
