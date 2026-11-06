/** Ceyo public landing — the same dark character-first look as the app. */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { forceDarkTheme } from "@/lib/theme";
import { Bot, LayoutGrid, Users } from "lucide-react";
import { AgentOrb } from "@/components/agent/AgentOrb";
import "@/styles/agent-hub.css";
import "@/styles/ceyo.css";

export default function CeyoLanding() {
  useEffect(() => forceDarkTheme(), []);
  return (
    <div className="agent-hub ceyo-landing" data-no-translate>
      <nav className="ceyo-land-nav">
        <span className="ceyo-logo">Ceyo</span>
        <Link to="/auth" className="hub-button hub-button-secondary">Sign in</Link>
      </nav>
      <section className="ceyo-land-hero">
        <div className="ceyo-orbs" aria-hidden>
          <AgentOrb color="ember" size={54} state="idle" />
          <span className="hub-primary-orb"><AgentOrb color="mono" size={96} state="hello" /></span>
          <AgentOrb color="mint" size={54} state="idle" />
        </div>
        <h1>Your own team of bots, in one calm place.</h1>
        <p>Talk to Ceyo, ask it for a new bot or a group chat, and let them work together. Super intelligence, made personal.</p>
        <Link to="/auth" className="hub-button hub-button-primary" style={{ flex: "none", padding: "0 30px" }}>Get started</Link>
      </section>
      <section className="ceyo-land-grid">
        <article><Bot size={22} /><h3>Create bots by asking</h3><p>Tell your main bot what you need. It builds a new bot with its own voice and instructions.</p></article>
        <article><Users size={22} /><h3>Group chats of bots</h3><p>Put several bots in one group. Each one answers with its own name and character.</p></article>
        <article><LayoutGrid size={22} /><h3>Connect your apps</h3><p>Link GitHub, Gmail, Shopify and more so your bots can act for you.</p></article>
      </section>
      <footer className="ceyo-land-foot">© Ceyo · ceyo.si <Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link></footer>
    </div>
  );
}
