/** Clean email-code sign in / sign up on the project's own Supabase auth. */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/ceyo-clean.css";

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const LEN = 6;

export async function routeAfterSignIn(nav: (p: string, o?: { replace: boolean }) => void) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data } = await supabase.from("profiles").select("onboarding_completed").eq("id", u.user.id).maybeSingle();
  nav(data?.onboarding_completed ? "/" : "/onboarding", { replace: true });
}

export default function AuthPage() {
  const nav = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(Array(LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => data.session && routeAfterSignIn(nav)); }, [nav]);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!emailOk(e)) return setErr("اكتب بريد إلكتروني صحيح");
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setErr(error.message.includes("rate") ? "استنى شوية قبل ما تطلب كود تاني" : "مقدرناش نبعت الكود، جرّب تاني");
    setStep("code"); setWait(60); setCode(Array(LEN).fill(""));
    setTimeout(() => refs.current[0]?.focus(), 50);
  };

  const verify = async (digits: string) => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: digits, type: "email" });
    setBusy(false);
    if (error) { setErr("الكود غلط أو انتهى، جرّب تاني"); setCode(Array(LEN).fill("")); refs.current[0]?.focus(); return; }
    await routeAfterSignIn(nav);
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "");
    const next = [...code];
    if (d.length > 1) { d.slice(0, LEN).split("").forEach((c, k) => (next[k] = c)); }
    else next[i] = d;
    setCode(next);
    if (d && i < LEN - 1) refs.current[Math.min(i + d.length, LEN - 1)]?.focus();
    const joined = next.join("");
    if (joined.length === LEN) verify(joined);
  };

  return (
    <div className="cz" dir="rtl">
      <header className="cz-top">
        <span className="cz-logo">Ceyo</span>
        {step === "code" && <button className="cz-link" onClick={() => setStep("email")}><ArrowRight size={18} /></button>}
      </header>
      <main className="cz-main">
        {step === "email" ? (
          <>
            <h1 className="cz-h1">أهلاً بيك</h1>
            <p className="cz-sub">اكتب بريدك وهنبعتلك كود دخول. لو جديد هنعملك حساب.</p>
            <form className="cz-card" onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "grid", gap: 12 }}>
              <input className="cz-input" type="email" dir="ltr" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              {err && <span className="cz-err">{err}</span>}
              <button className="cz-btn" disabled={busy || !email}>{busy ? "جاري الإرسال…" : "ابعت الكود"}</button>
            </form>
            <p className="cz-sub" style={{ fontSize: 12 }}>بالمتابعة أنت موافق على <a href="/terms">الشروط</a> و<a href="/privacy">الخصوصية</a></p>
          </>
        ) : (
          <>
            <h1 className="cz-h1">اكتب الكود</h1>
            <p className="cz-sub">بعتنا كود من {LEN} أرقام على <b dir="ltr">{email}</b></p>
            <div className="cz-otp">
              {code.map((c, i) => (
                <input key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={LEN} value={c} disabled={busy}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus(); }} />
              ))}
            </div>
            {err && <span className="cz-err">{err}</span>}
            <button className="cz-btn cz-btn-ghost" disabled={wait > 0 || busy} onClick={send}>{wait > 0 ? `إعادة الإرسال بعد ${wait} ث` : "ابعت الكود تاني"}</button>
          </>
        )}
      </main>
    </div>
  );
}
