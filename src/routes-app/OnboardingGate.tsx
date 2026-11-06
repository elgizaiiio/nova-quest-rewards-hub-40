import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Sends signed-in users who haven't finished first-run setup to /onboarding. */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"wait" | "ok" | "setup">("wait");
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setState("ok");
      const { data: p } = await supabase.from("profiles").select("onboarding_completed").eq("id", data.user.id).maybeSingle();
      setState(p?.onboarding_completed ? "ok" : "setup");
    });
  }, []);
  if (state === "setup") return <Navigate to="/onboarding" replace />;
  return state === "ok" ? <>{children}</> : null;
}
