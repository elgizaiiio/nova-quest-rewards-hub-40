/** First-run setup: profile → what you do → create your primary bot. */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, User, Code2, Palette, GraduationCap, Briefcase, Clapperboard, HelpCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { forceDarkTheme } from "@/lib/theme";
import { AgentForm, type AgentFormValue } from "@/pages/agent/hub/HubPanels";
import "@/styles/onboarding.css";

const TYPES = [
  { id: "developer", t: "Developer", I: Code2 },
  { id: "designer", t: "Designer", I: Palette },
  { id: "student", t: "Student", I: GraduationCap },
  { id: "business", t: "Business owner", I: Briefcase },
  { id: "creator", t: "Content creator", I: Clapperboard },
  { id: "other", t: "Something else", I: HelpCircle },
];
const AGES = Array.from({ length: 108 }, (_, i) => i + 13);
const ROW = 48;

async function toAvatar(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
  const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
  c.getContext("2d")!.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

function AgeWheel({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  useEffect(() => { const el = ref.current; if (el) { el.scrollTop = AGES.indexOf(value) * ROW; setScrollTop(el.scrollTop); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = () => {
    const el = ref.current; if (!el) return;
    setScrollTop(el.scrollTop);
    const n = AGES[Math.round(el.scrollTop / ROW)];
    if (n && n !== value) onChange(n);
  };
  return (
    <div className="ob-wheel">
      <div className="ob-wheel-band" aria-hidden />
      <div ref={ref} className="ob-wheel-scroll" onScroll={onScroll} role="listbox" aria-label="Age">
        <div style={{ height: ROW }} />
        {AGES.map((a, i) => {
          const d = Math.min(Math.abs(i * ROW - scrollTop) / ROW, 2.5);
          return (
            <button key={a} type="button" role="option" aria-selected={a === value} className="ob-wheel-item"
              style={{ opacity: 1 - d * 0.32, transform: `scale(${1 - d * 0.1}) rotateX(${(i * ROW - scrollTop) / ROW * -18}deg)` }}
              onClick={() => ref.current?.scrollTo({ top: i * ROW, behavior: "smooth" })}>{a}</button>
          );
        })}
        <div style={{ height: ROW }} />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const nav = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [age, setAge] = useState(22);
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => forceDarkTheme(), []);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return nav("/auth", { replace: true });
      setUid(data.user.id);
      const { data: p } = await supabase.from("profiles").select("display_name,avatar_url,onboarding_completed").eq("id", data.user.id).maybeSingle();
      if (p?.onboarding_completed) return nav("/", { replace: true });
      if (p?.display_name) setName(p.display_name);
      if (p?.avatar_url) setAvatar(p.avatar_url);
    });
  }, [nav]);

  const finish = async (v: AgentFormValue) => {
    if (!uid) return;
    setBusy(true); setErr("");
    const { data: bot, error: e1 } = await supabase.from("bots").insert({
      owner_id: uid, name: v.name, description: v.description, instructions: v.prompt,
      category: "primary", look: (v.look ?? {}) as never,
    }).select("id").single();
    if (e1 || !bot) { setBusy(false); return setErr("Couldn't create your bot. Try again."); }
    const { error: e2 } = await supabase.from("profiles").update({
      display_name: name.trim(), avatar_url: avatar, age, user_type: type,
      primary_bot_id: bot.id, onboarding_completed: true,
    }).eq("id", uid);
    setBusy(false);
    if (e2) return setErr("Couldn't save your profile. Try again.");
    nav("/", { replace: true });
  };

  return (
    <div className="ob" dir="ltr">
      <header className="ob-top">
        {step > 0 ? <button className="ob-back" onClick={() => setStep(step - 1)} aria-label="Back"><ArrowLeft size={20} /></button> : <span style={{ width: 40 }} />}
        <div className="ob-dots">{[0, 1, 2].map((d) => <span key={d} className={d === step ? "on" : ""} />)}</div>
        <span style={{ width: 40 }} />
      </header>
      {step === 2 && (
        <main className="ob-main ob-bot" key={step}>
          <h1>Create your main bot</h1>
          <p className="ob-sub">Your main assistant. You can change it anytime.</p>
          <AgentForm lang="en" title="" cta="Create" busy={busy} error={err} onSubmit={(v) => void finish(v)} onCancel={() => setStep(1)} />
        </main>
      )}
      {step < 2 && <main className="ob-main" key={step}>
        {step === 0 && (
          <>
            <h1>Tell us about you</h1>
            <p className="ob-sub">So your bots know who they're helping.</p>
            <button type="button" className="ob-photo" onClick={() => file.current?.click()} aria-label="Your photo">
              {avatar ? <img src={avatar} alt="" /> : <span className="ob-initial">{name.trim()[0]?.toUpperCase() || <User size={34} />}</span>}
              <span className="ob-photo-badge"><Camera size={14} /></span>
            </button>
            <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setAvatar(await toAvatar(f)); }} />
            <input className="ob-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} />
            <p className="ob-label">How old are you?</p>
            <AgeWheel value={age} onChange={setAge} />
            <button className="ob-btn" disabled={name.trim().length < 2} onClick={() => setStep(1)}>Continue</button>
          </>
        )}
        {step === 1 && (
          <>
            <h1>What do you do?</h1>
            <p className="ob-sub">We'll tune your bots to fit you.</p>
            <div className="ob-opts">
              {TYPES.map(({ id, t, I }) => (
                <button key={id} className={`ob-opt ${type === id ? "on" : ""}`} onClick={() => setType(id)}><I size={22} />{t}</button>
              ))}
            </div>
            <button className="ob-btn" disabled={!type} onClick={() => setStep(2)}>Continue</button>
          </>
        )}
      </main>}
    </div>
  );
}
