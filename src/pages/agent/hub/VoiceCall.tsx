import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
import type { AgentInfo } from "@/lib/agentsky/client";
import { BotAvatar, type HubLang } from "./HubParts";

/** Grok-style floating call bar for one-to-one chats: listens, sends what the
 *  user says, and reads the bot's reply aloud with the device voice. */
export function VoiceCallBar({ agent, lang, busy, lastReply, onSay, onEnd }: {
  agent: AgentInfo; lang: HubLang; busy: boolean; lastReply: string; onSay: (text: string) => void; onEnd: () => void;
}) {
  const ar = lang === "ar";
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<"listening" | "thinking" | "speaking">("listening");
  const rec = useRef<any>(null);
  const spokenFor = useRef(lastReply);
  const wasBusy = useRef(busy);
  const alive = useRef(true);

  const startListening = () => {
    if (!alive.current || muted) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try { rec.current?.abort?.(); } catch {}
    const r = new SR();
    r.lang = ar ? "ar-EG" : "en-US";
    r.interimResults = false;
    r.onresult = (e: any) => {
      const t = Array.from(e.results as any[]).map((x: any) => x[0].transcript).join(" ").trim();
      if (t) { setPhase("thinking"); onSay(t); }
    };
    r.onend = () => { if (alive.current && phaseRef.current === "listening" && !mutedRef.current) setTimeout(startListening, 250); };
    rec.current = r;
    try { r.start(); setPhase("listening"); } catch {}
  };
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const mutedRef = useRef(muted); mutedRef.current = muted;

  useEffect(() => { alive.current = true; startListening(); return () => { alive.current = false; try { rec.current?.abort?.(); } catch {} window.speechSynthesis?.cancel(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (muted) { try { rec.current?.abort?.(); } catch {} } else if (phase === "listening") startListening(); }, [muted]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the bot finishes, speak the reply then listen again.
  useEffect(() => {
    if (busy) { setPhase("thinking"); wasBusy.current = true; return; }
    if (!wasBusy.current || !lastReply || lastReply === spokenFor.current) return;
    wasBusy.current = false;
    spokenFor.current = lastReply;
    const synth = window.speechSynthesis;
    if (!synth) { setPhase("listening"); startListening(); return; }
    const u = new SpeechSynthesisUtterance(lastReply.replace(/[#*_`>\[\]]/g, "").slice(0, 1200));
    u.lang = /[\u0600-\u06FF]/.test(lastReply) ? "ar-EG" : "en-US";
    u.onend = () => { setPhase("listening"); startListening(); };
    setPhase("speaking");
    synth.cancel(); synth.speak(u);
  }, [busy, lastReply]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = muted ? (ar ? "المايك مقفول" : "Muted") : phase === "speaking" ? (ar ? "بيتكلم" : "Speaking") : phase === "thinking" ? (ar ? "بيفكر" : "Thinking") : (ar ? "بيسمعك" : "Listening");

  return (
    <div className="cx-call" role="dialog" aria-label={ar ? "مكالمة صوتية" : "Voice call"}>
      <BotAvatar agent={agent} size={44} state={phase === "speaking" ? "talking" : phase === "thinking" ? "thinking" : "idle"} />
      <div className="cx-call-level" data-phase={muted ? "muted" : phase} title={label}><span /></div>
      <button type="button" className="cx-call-btn" data-off={muted} aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>{muted ? <MicOff size={19} /> : <Mic size={19} />}</button>
      <button type="button" className="cx-call-btn cx-call-end" aria-label={ar ? "إنهاء المكالمة" : "End call"} onClick={onEnd}><X size={20} /></button>
      <span className="cx-call-grip" />
    </div>
  );
}
