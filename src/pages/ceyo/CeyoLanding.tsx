/** Ceyo welcome — light, calm slides inspired by modern agent apps. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, FileText, Smartphone, Gamepad2, Globe, Search, Workflow, Bot } from "lucide-react";
import "@/styles/ceyo-clean.css";

const chips = [
  { t: "مستندات", I: FileText, bg: "oklch(0.93 0.06 75)", fg: "oklch(0.4 0.08 60)", x: "58%", y: "0%", r: 18 },
  { t: "أتمتة", I: Workflow, bg: "oklch(0.92 0.06 165)", fg: "oklch(0.38 0.08 165)", x: "12%", y: "4%", r: -6 },
  { t: "تطبيقات", I: Smartphone, bg: "oklch(0.92 0.04 240)", fg: "oklch(0.38 0.08 250)", x: "34%", y: "24%", r: 10 },
  { t: "تطوير ألعاب", I: Gamepad2, bg: "oklch(0.92 0.05 300)", fg: "oklch(0.38 0.1 300)", x: "24%", y: "48%", r: 4 },
  { t: "بوتات", I: Bot, bg: "oklch(0.92 0.07 130)", fg: "oklch(0.38 0.08 130)", x: "64%", y: "52%", r: -10 },
  { t: "موقع ويب", I: Globe, bg: "oklch(0.92 0.04 240)", fg: "oklch(0.38 0.08 250)", x: "6%", y: "74%", r: -12 },
  { t: "بحث موسّع", I: Search, bg: "oklch(0.93 0.04 190)", fg: "oklch(0.38 0.07 200)", x: "58%", y: "80%", r: 12 },
];
const apps = ["🐙", "📅", "✉️", "💬", "📝", "🎨", "⚡", "🔗", "📊", "🛍️", "🎵", "📁"];

export default function CeyoLanding() {
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const next = () => (i < 1 ? setI(i + 1) : nav("/auth"));
  return (
    <div className="cc" dir="rtl">
      <header className="cc-top">
        <span className="cc-logo">Ceyo</span>
        <button className="cc-link" onClick={() => nav("/auth")}>تخطي</button>
      </header>
      <main className="cc-main">
        {i === 0 ? (
          <>
            <Sparkles size={34} />
            <h1 className="cc-h1">بوتاتك الذكية<br />لكل مهامك</h1>
            <p className="cc-sub">اصنع فريقك من البوتات، وخليهم يشتغلوا معاك في مكان واحد هادي.</p>
            <div className="cc-chips" aria-hidden>
              {chips.map(({ t, I, bg, fg, x, y, r }, k) => (
                <span key={t} className="cc-chip" style={{ background: bg, color: fg, insetInlineStart: x, top: y, rotate: `${r}deg`, animationDelay: `${k * 0.4}s` }}>
                  <I size={18} />{t}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="cc-h1">اربط <span className="cc-pill">كل</span><br />أدواتك المفضلة</h1>
            <p className="cc-sub">بوتاتك تقدر تشتغل على تطبيقاتك وتنفذ عنك.</p>
            <div className="cc-grid" aria-hidden>{apps.map((a) => <div key={a} className="cc-tile">{a}</div>)}</div>
          </>
        )}
      </main>
      <footer className="cc-main" style={{ flex: "none", paddingBottom: 32 }}>
        <div className="cc-dots">{[0, 1].map((d) => <span key={d} className={`cc-dot ${d === i ? "on" : ""}`} />)}</div>
        <button className="cc-btn" onClick={next}>{i < 1 ? "التالي" : "ابدأ الآن"}</button>
        <button className="cc-link" onClick={() => nav("/auth")}>عندي حساب؟ سجّل دخول</button>
      </footer>
    </div>
  );
}
