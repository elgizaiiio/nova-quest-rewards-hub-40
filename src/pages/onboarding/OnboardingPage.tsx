/** First-run setup: profile → what you do → create your primary bot. */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Code2, Palette, GraduationCap, Briefcase, Clapperboard, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/ceyo-clean.css";

const TYPES = [
  { id: "developer", t: "مطور / مبرمج", I: Code2 },
  { id: "designer", t: "مصمم", I: Palette },
  { id: "student", t: "طالب", I: GraduationCap },
  { id: "business", t: "صاحب بيزنس", I: Briefcase },
  { id: "creator", t: "صانع محتوى", I: Clapperboard },
  { id: "other", t: "حاجة تانية", I: HelpCircle },
];

async function toAvatar(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
  const k = Math.max(s / img.width, s / img.height), w = img.width * k, h = img.height * k;
  c.getContext("2d")!.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

export default function OnboardingPage() {
  const nav = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [age, setAge] = useState("");
  const [type, setType] = useState("");
  const [botName, setBotName] = useState("");
  const [botDesc, setBotDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);

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

  const ageN = Number(age);
  const ok0 = name.trim().length >= 2 && ageN >= 13 && ageN <= 120;

  const finish = async () => {
    if (!uid || botName.trim().length < 2) return;
    setBusy(true); setErr("");
    const { data: bot, error: e1 } = await supabase.from("bots").insert({
      owner_id: uid, name: botName.trim(), description: botDesc.trim() || null,
      instructions: botDesc.trim() || null, category: "primary",
    }).select("id").single();
    if (e1 || !bot) { setBusy(false); return setErr("مقدرناش نعمل البوت، جرّب تاني"); }
    const { error: e2 } = await supabase.from("profiles").update({
      display_name: name.trim(), avatar_url: avatar, age: ageN, user_type: type,
      primary_bot_id: bot.id, onboarding_completed: true,
    }).eq("id", uid);
    setBusy(false);
    if (e2) return setErr("مقدرناش نحفظ بياناتك، جرّب تاني");
    nav("/", { replace: true });
  };

  return (
    <div className="cz" dir="rtl">
      <header className="cz-top">
        <span className="cz-logo">Ceyo</span>
        <div className="cz-dots">{[0, 1, 2].map((d) => <span key={d} className={`cz-dot ${d === step ? "on" : ""}`} />)}</div>
      </header>
      <main className="cz-main">
        {step === 0 && (
          <>
            <h1 className="cz-h1">عرّفنا بنفسك</h1>
            <div className="cz-card">
              <button type="button" className="cz-avatar" onClick={() => file.current?.click()} aria-label="صورتك">
                {avatar ? <img src={avatar} alt="" /> : <Camera size={28} />}
              </button>
              <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setAvatar(await toAvatar(f)); }} />
              <label className="cz-label">اسمك</label>
              <input className="cz-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك" />
              <label className="cz-label">عمرك</label>
              <input className="cz-input" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="مثلاً 24" />
              {age && (ageN < 13 || ageN > 120) && <span className="cz-err">لازم العمر يكون من 13 لـ 120</span>}
            </div>
            <button className="cz-btn" disabled={!ok0} onClick={() => setStep(1)}>التالي</button>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="cz-h1">إنت بتشتغل في إيه؟</h1>
            <p className="cz-sub">عشان نظبط بوتاتك على مقاسك.</p>
            <div className="cz-opts">
              {TYPES.map(({ id, t, I }) => (
                <button key={id} className={`cz-opt ${type === id ? "on" : ""}`} onClick={() => setType(id)}><I size={22} />{t}</button>
              ))}
            </div>
            <button className="cz-btn" disabled={!type} onClick={() => setStep(2)}>التالي</button>
            <button className="cz-link" onClick={() => setStep(0)}>رجوع</button>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="cz-h1">اعمل بوتك الأساسي</h1>
            <p className="cz-sub">ده هيكون مساعدك الرئيسي، وتقدر تغيّره بعدين.</p>
            <div className="cz-card">
              <label className="cz-label">اسم البوت</label>
              <input className="cz-input" value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="مثلاً: نور" maxLength={40} />
              <label className="cz-label">عايزه يساعدك في إيه؟</label>
              <textarea className="cz-input" rows={3} value={botDesc} onChange={(e) => setBotDesc(e.target.value)} placeholder="مثلاً: يساعدني في البرمجة وتنظيم يومي" maxLength={500} />
              {err && <span className="cz-err">{err}</span>}
            </div>
            <button className="cz-btn" disabled={busy || botName.trim().length < 2} onClick={finish}>{busy ? "جاري الإنشاء…" : "ابدأ"}</button>
            <button className="cz-link" onClick={() => setStep(1)}>رجوع</button>
          </>
        )}
      </main>
    </div>
  );
}
