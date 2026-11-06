/** Ceyo settings — compact dark sheets matching the supplied mobile references. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { askConfirm } from "@/components/common/CeyoConfirm";
import {
  ArrowUpRight, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Contrast, Copy, CreditCard,
  KeyRound, Moon, Plus, Search, Smartphone, Sun, Trash2, User, Vault, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/legacyClient";
import { useCredits } from "@/hooks/useCredits";
import { getStoredTheme, setTheme, type ThemeMode } from "@/lib/theme";
import { loadWorkspace, useWorkspaceStore } from "@/lib/agentsky/store";import { integrations as CATALOG, type Integration } from "@/lib/integrationsData";
import {
  disconnectIntegration, loadIntegrationConnections, startIntegrationConnection, waitForConnectionRefresh,
  integrationSlug, type IntegrationAccount,
} from "@/lib/integrationBackend";
import { Button } from "@/components/ui/button";
import { IntegrationLogo } from "@/components/chat/integrations/IntegrationRow";
import {
  DEFAULT_PERMISSIONS, PERMISSIONS_STORAGE_KEY, addPermissionRule, parsePermissionPreferences,
  permissionSummary, removePermissionRule, type PermissionPreferences, type PermissionRuleKind,
} from "./settingsPreferences";
import "@/styles/agent-hub.css";
import "@/styles/ceyo.css";

type Nav = (to: string) => void;

function Shell({ title, back, children, action }: { title: string; back: () => void; children: ReactNode; action?: ReactNode }) {
  return (
    <div key={title} className="agent-hub ceyo-page" data-no-translate>
      <header className="ceyo-top">
        <button type="button" className="gx-round" aria-label={title === "Settings" ? "Close" : "Back"} onClick={back}>
          {title === "Settings" ? <X size={20} /> : <ChevronLeft size={20} />}
        </button>
        {title !== "Settings" && <h1>{title}</h1>}
        <span className="ceyo-top-action">{action}</span>
      </header>
      <div className="ceyo-scroll">{children}</div>
    </div>
  );
}

function Row({ icon, label, value, onClick, danger, right, sub, checked, disabled }: {
  icon?: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  right?: ReactNode;
  sub?: string;
  checked?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="ceyo-row"
      data-danger={danger}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={checked}
      tabIndex={onClick ? 0 : -1}
    >
      {icon && <span className="ceyo-row-icon">{icon}</span>}
      <span className="ceyo-row-label">{sub ? <><strong>{label}</strong><small>{sub}</small></> : label}</span>
      {value && <span className="ceyo-row-value">{value}</span>}
      {right ?? (onClick && !danger ? <ChevronRight size={17} className="ceyo-row-chev" /> : null)}
    </button>
  );
}

const Group = ({ children, title }: { children: ReactNode; title?: string }) => (
  <section className="ceyo-group">{title && <h2>{title}</h2>}<div>{children}</div></section>
);

const Toggle = ({ on }: { on: boolean }) => <span className="ceyo-switch" data-on={on}><i /></span>;
const Ext = () => <ArrowUpRight size={18} className="ceyo-row-chev" />;

async function signOut(nav: Nav) {
  if (!(await askConfirm({ title: "Sign out of Ceyo?", body: "Your bots and chats stay saved. Sign back in anytime.", confirm: "Sign Out", danger: true }))) return;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    nav("/welcome");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not sign out");
  }
}

function useMe() {
  const [me, setMe] = useState({ email: "", name: "", avatar: "" });
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const metadata = (data.user?.user_metadata || {}) as Record<string, string>;
      setMe({
        email: data.user?.email || "",
        name: metadata.full_name || metadata.name || "",
        avatar: metadata.avatar_url || metadata.picture || "",
      });
    });
  }, []);
  return me;
}

function MeCard({ onClick }: { onClick?: () => void }) {
  const me = useMe();
  return (
    <button type="button" className="ceyo-row ceyo-me" onClick={onClick} tabIndex={onClick ? 0 : -1}>
      <span className="ceyo-avatar">{me.avatar ? <img src={me.avatar} alt="" /> : (me.name || me.email || "C").charAt(0).toUpperCase()}</span>
      <span className="ceyo-row-label"><strong>{me.name || "Ceyo account"}</strong><small>{me.email}</small></span>
      {onClick && <ChevronRight size={17} className="ceyo-row-chev" />}
    </button>
  );
}

function usageFor(credits: number | null, plan: string) {
  const cap = plan === "free" ? 50 : plan.includes("max") || plan.includes("ultra") ? 5000 : 1000;
  const left = Math.max(0, Number(credits ?? 0));
  const used = Math.min(100, Math.round(((cap - Math.min(left, cap)) / cap) * 100));
  return { cap, left, used };
}

function Main({ nav }: { nav: Nav }) {
  const [haptics, setHaptics] = useState(true);
  const [notify, setNotify] = useState(false);
  const [autoTz, setAutoTz] = useState(true);
  const [theme, setThemeMode] = useState<ThemeMode>("dark");
  const [language, setLanguage] = useState("System");
  const [permissions, setPermissions] = useState<PermissionPreferences>(DEFAULT_PERMISSIONS);
  const { credits, plan, loading } = useCredits() as { credits: number | null; plan: string; loading: boolean };
  const usage = usageFor(credits, plan);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  useEffect(() => {
    setHaptics(localStorage.getItem("ceyo_haptics") !== "off");
    setNotify(localStorage.getItem("ceyo_notify") === "on");
    setAutoTz(localStorage.getItem("ceyo_auto_tz") !== "off");
    setThemeMode(getStoredTheme());
    const savedLanguage = localStorage.getItem("ceyo_language") || "system";
    setLanguage(LANGUAGES.find(([code]) => code === savedLanguage)?.[1] || "System");
    setPermissions(parsePermissionPreferences(localStorage.getItem(PERMISSIONS_STORAGE_KEY)));
    applySurface(localStorage.getItem("ceyo_surface") === "bot" ? "bot" : "black");
  }, []);

  const flip = (key: string, value: boolean, set: (value: boolean) => void) => {
    set(value);
    localStorage.setItem(key, value ? "on" : "off");
    if (key === "ceyo_haptics" && value && "vibrate" in navigator) navigator.vibrate(12);
  };

  const toggleNotifications = async () => {
    if (notify) return flip("ceyo_notify", false, setNotify);
    if (!("Notification" in window)) return toast.error("Notifications are not supported on this device");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return toast.error("Allow notifications in your browser settings first");
    flip("ceyo_notify", true, setNotify);
  };

  return (
    <Shell title="Settings" back={() => nav("/")}>
      <Group>
        <MeCard onClick={() => nav("/settings/account")} />
        <Row label="Usage" value={loading ? "…" : `${usage.used}%`} onClick={() => nav("/settings/usage")} />
        <Row label="Manage Subscription" onClick={() => nav("/settings/subscription")} />
        <Row label="Vault" sub="Logins, cards and contact info Ceyo can use" onClick={() => nav("/settings/vault")} />
      </Group>
      <Group><Row label="Connect apps" sub="Search plugins" onClick={() => nav("/settings/apps")} /></Group>
      <Group title="Bot">
        <Row label="Permissions" sub={permissionSummary(permissions)} onClick={() => nav("/settings/permissions")} />
        <Row label="Set Time Zone Automatically" sub="Your Bot's computer follows this device's time zone." checked={autoTz} onClick={() => flip("ceyo_auto_tz", !autoTz, setAutoTz)} right={<Toggle on={autoTz} />} />
        <Row label="Time Zone" value={tz} right={<span />} />
        <Row label="Bot Computer" onClick={() => nav("/settings/computer")} />
        <Row label="Manage your devices" onClick={() => nav("/settings/devices")} />
        <Row label="Import Memory" onClick={() => nav("/settings/memory")} />
      </Group>
      <Group>
        <Row label="Notifications" checked={notify} onClick={() => void toggleNotifications()} right={<Toggle on={notify} />} />
        <Row label="Appearance" value={theme === "system" ? "Follow System" : theme === "dark" ? "Dark" : "Light"} onClick={() => nav("/settings/appearance")} />
        <Row label="Language" value={language} onClick={() => nav("/settings/language")} />
        <Row label="Haptics" value={haptics ? "On" : "Off"} onClick={() => flip("ceyo_haptics", !haptics, setHaptics)} />
      </Group>
      <Group>
        <Row label="Help Center" sub="Guides for bots, groups and routines" onClick={() => nav("/docs")} right={<Ext />} />
        <Row label="Privacy Policy" onClick={() => nav("/privacy")} right={<Ext />} />
        <Row label="Terms of Service" onClick={() => nav("/terms")} right={<Ext />} />
        <Row label="Subscription Terms" onClick={() => nav("/subscription-terms")} right={<Ext />} />
      </Group>
      <p className="ceyo-legal-note">If you subscribe through a Teams, Enterprise or other plan, the agreement for that plan applies.</p>
      <Group><Row label="Send Feedback" onClick={() => nav("/settings/feedback")} /></Group>
      <Group><Row label="Sign Out" danger onClick={() => void signOut(nav)} /></Group>
      <div className="ceyo-brand-foot"><span className="ceyo-brand-orb"><i /><i /></span><strong>Ceyo</strong><small>1.0.0</small></div>
    </Shell>
  );
}

function Account({ nav }: { nav: Nav }) {
  const me = useMe();
  const addAccount = async () => {
    if (!(await askConfirm({ title: "Add another account?", body: "You will be signed out of this account to sign in with another one.", confirm: "Continue" }))) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      nav("/auth");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not switch account");
    }
  };
  return (
    <Shell title="Account" back={() => nav("/settings")}>
      <Group><MeCard /></Group>
      <Group title="Switch Account">
        <Row label={me.email || "—"} right={<Check size={18} />} />
        <Row icon={<Plus size={20} />} label="Add Account" onClick={() => void addAccount()} right={<span />} />
      </Group>
      <Group><Row label="Sign Out" danger onClick={() => void signOut(nav)} /></Group>
      <Group><Row icon={<Trash2 size={19} />} label="Delete Account" danger onClick={() => nav("/settings/delete-account")} /></Group>
      <p className="ceyo-note">Permanently deletes your Ceyo account. This can't be undone.</p>
    </Shell>
  );
}

function Usage({ nav }: { nav: Nav }) {
  const { credits, plan, loading } = useCredits() as { credits: number | null; plan: string; loading: boolean };
  const [showPlan, setShowPlan] = useState(false);
  const usage = usageFor(credits, plan);
  return (
    <Shell title="Usage" back={() => nav("/settings")}>
      <div className="ceyo-usage-panel">
        <div className="ceyo-usage-body">
          <div className="ceyo-usage-head"><strong>Weekly usage limit</strong><span>Resets weekly</span></div>
          <div className="ceyo-bar" aria-label={loading ? "Loading usage" : `${usage.used}% used`}><i style={{ width: `${loading ? 0 : usage.used}%` }} /></div>
          <span className="ceyo-usage-percent">{loading ? "…" : `${usage.used}%`}</span>
        </div>
        <button type="button" className="ceyo-usage-manage" onClick={() => setShowPlan((value) => !value)} aria-expanded={showPlan}>
          Manage usage <ChevronRight size={17} />
        </button>
      </div>
      {showPlan && <Group title="Subscription">
        <Row label="Current plan" value={plan.charAt(0).toUpperCase() + plan.slice(1)} />
        <Row label="Credits remaining" value={loading ? "…" : usage.left.toLocaleString()} />
        <Row label="Weekly credit limit" value={usage.cap.toLocaleString()} />
      </Group>}
    </Shell>
  );
}

const PLANS = [
  { id: "plus", name: "Plus", price: 20, yearly: 199, mult: "4x", base: "", groups: [
    { title: "SI benefits", items: ["Ceyo Bot", "Newest Ceyo models", "Faster chat replies", "Create images and videos with SI", "Cloud agents and automation", "Code hosting and SI code reviews"] },
  ] },
  { id: "pro", name: "Pro", price: 60, yearly: 0, mult: "15x", base: "Plus", groups: [
    { title: "SI benefits", items: ["Create 1080p videos", "Priority model access at peak times", "Faster replies and generations"] },
  ] },
  { id: "ultra", name: "Ultra", price: 120, yearly: 0, mult: "50x", base: "Pro", groups: [
    { title: "SI benefits", items: ["Most capable chat models", "Early access to new products and models", "Fastest replies and generations"] },
  ] },
] as const;

function Plans({ nav }: { nav: Nav }) {
  const { plan } = useCredits() as { plan: string };
  const [tab, setTab] = useState(0);
  const [yearly, setYearly] = useState(false);
  const p = PLANS[tab];
  const current = plan?.toLowerCase() === p.id;
  return (
    <div className="agent-hub ceyo-page ceyo-plans" data-no-translate>
      <button type="button" className="gx-round ceyo-plans-close" aria-label="Close" onClick={() => nav("/settings")}><X size={20} /></button>
      <div className="ceyo-scroll">
        <div className="ceyo-plans-brand"><span className="ceyo-brand-orb"><i /><i /></span></div>
        <h1 className="ceyo-plans-title">One subscription.<br />Access to everything.</h1>
        <div className="ceyo-plans-card">
          <div className="ceyo-plans-tabs">
            {PLANS.map((x, i) => <button key={x.id} type="button" data-on={i === tab} onClick={() => { setTab(i); setYearly(false); }}>{x.name}</button>)}
          </div>
          {p.base && <p className="ceyo-plans-muted">Everything in {p.base}, and:</p>}
          <strong className="ceyo-plans-mult">{p.mult}</strong>
          <p className="ceyo-plans-sub">more usage than Free</p>
          {p.groups.map((g) => <div key={g.title}>
            <p className="ceyo-plans-muted ceyo-plans-gt">{g.title}</p>
            <ul>{g.items.map((it) => <li key={it}><Check size={16} />{it}</li>)}</ul>
          </div>)}
          <p className="ceyo-plans-muted ceyo-plans-gt">Our other apps</p>
          <ul><li className="ceyo-plans-muted">Coming soon</li></ul>
        </div>
      </div>
      <div className="ceyo-plans-foot">
        <div className="ceyo-plans-prices">
          <button type="button" data-on={!yearly} onClick={() => setYearly(false)}><b>${p.price}</b> <span>{p.yearly ? "monthly" : "billed monthly"}</span></button>
          {p.yearly > 0 && <button type="button" data-on={yearly} onClick={() => setYearly(true)}><b>${p.yearly}</b> <span>yearly</span><small>${(p.yearly / 12).toFixed(2)}/mo · <em>Save 17%</em></small></button>}
        </div>
        <button type="button" className="ceyo-plans-cta" data-current={current} disabled={current} onClick={() => toast("Payments are coming soon")}>{current ? "Current plan" : "Change plan"}</button>
        <p className="ceyo-plans-legal">Subscriptions renew automatically until cancelled. Cancel anytime at least 24 hours before renewal. Prices may change.</p>
      </div>
    </div>
  );
}

type VaultItem = { id: string; kind: "login" | "card" | "contact"; title: string; detail: string };
const VAULT_KEY = "ceyo_vault_v1";

function Vault_({ nav }: { nav: Nav }) {
  const [tab, setTab] = useState<"all" | VaultItem["kind"]>("all");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [adding, setAdding] = useState<VaultItem["kind"] | null>(null);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem(VAULT_KEY) || "[]")); } catch { setItems([]); }
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  const save = (next: VaultItem[]) => { setItems(next); localStorage.setItem(VAULT_KEY, JSON.stringify(next)); };
  const shown = items.filter((item) => (tab === "all" || item.kind === tab) && `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
  const labels = { login: "Login", card: "Card", contact: "Contact info" } as const;
  const count = (kind: VaultItem["kind"]) => items.filter((item) => item.kind === kind).length;
  const openAdd = (kind: VaultItem["kind"]) => { setAdding(kind); setMenu(false); setTitle(""); setDetail(""); };
  return (
    <Shell
      title="Vault"
      back={() => nav("/settings")}
      action={<div className="hub-plus-wrap" ref={menuRef}>
        <button type="button" className="gx-round" aria-label="Add vault item" onClick={() => setMenu((value) => !value)}><Plus size={21} /></button>
        {menu && <div className="hub-menu hub-plus-menu ceyo-vault-menu" role="menu">
          <button type="button" onClick={() => openAdd("login")}><KeyRound size={17} />Login</button>
          <button type="button" onClick={() => openAdd("card")}><CreditCard size={17} />Card</button>
          <button type="button" onClick={() => openAdd("contact")}><User size={17} />Contact info</button>
        </div>}
      </div>}
    >
      <div className="hub-search-filters ceyo-tabs">
        <button type="button" data-active={tab === "all"} onClick={() => setTab("all")}>All <span>{items.length}</span></button>
        <button type="button" data-active={tab === "login"} onClick={() => setTab("login")}>Logins <span>{count("login")}</span></button>
        <button type="button" data-active={tab === "card"} onClick={() => setTab("card")}>Payments <span>{count("card")}</span></button>
        <button type="button" data-active={tab === "contact"} onClick={() => setTab("contact")}>Contact info <span>{count("contact")}</span></button>
      </div>
      {adding && <form className="ceyo-card ceyo-vault-form" onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        save([{ id: crypto.randomUUID(), kind: adding, title: title.trim(), detail: detail.trim() }, ...items]);
        setAdding(null);
        toast.success("Saved to your vault");
      }}>
        <strong>New {labels[adding].toLowerCase()}</strong>
        <input className="ceyo-input" aria-label="Title" maxLength={100} placeholder={adding === "login" ? "Website" : adding === "card" ? "Card name" : "Name"} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        <input className="ceyo-input" aria-label="Details" maxLength={160} placeholder={adding === "login" ? "Username or email" : adding === "card" ? "Last 4 digits" : "Phone or address"} value={detail} onChange={(event) => setDetail(event.target.value)} />
        <div className="hub-form-footer"><button type="submit" className="hub-button hub-button-primary">Save</button><button type="button" className="hub-button hub-button-secondary" onClick={() => setAdding(null)}>Cancel</button></div>
      </form>}
      {shown.length > 0 && <div className="ceyo-vault-list">{shown.map((item) => <div className="ceyo-vault-row" key={item.id}>
        <span className="ceyo-row-icon">{item.kind === "card" ? <CreditCard size={18} /> : item.kind === "login" ? <KeyRound size={18} /> : <User size={18} />}</span>
        <span><strong>{item.title}</strong><small>{item.detail}</small></span>
        <button type="button" aria-label={`Delete ${item.title}`} onClick={() => save(items.filter((candidate) => candidate.id !== item.id))}><Trash2 size={16} /></button>
      </div>)}</div>}
      {!shown.length && !adding && <div className="hub-empty-state"><span className="hub-empty-icon"><Vault size={22} /></span><strong>{items.length ? "No matching items" : "Your vault is empty"}</strong><p>{items.length ? "Try another search or category." : "Add a login, card label or contact info from the + button."}</p></div>}
      <p className="ceyo-vault-note">Ceyo never stores a saved card's full number or security code. Logins and contact info are saved on this device.</p>
      <div className="ceyo-bottom-search"><Search size={17} /><input aria-label="Search Vault" placeholder="Search Vault" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    </Shell>
  );
}

function Apps({ nav, appId }: { nav: Nav; appId?: string }) {
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [accounts, setAccounts] = useState<IntegrationAccount[]>([]);
  const [error, setError] = useState("");
  const [cat, setCat] = useState("All");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const refresh = async (): Promise<boolean> => {
    try { const state = await loadIntegrationConnections(CATALOG); setConnected(state.connectedApps); setAccounts(state.accounts); setError(""); return true; } catch (e) { setError(e instanceof Error ? e.message : "Could not load accounts"); return false; }
  };
  useEffect(() => { void refresh(); }, []);
  const cats = useMemo(() => ["All", ...Array.from(new Set(CATALOG.map((item) => item.category)))], []);
  const filtered = CATALOG.filter((item) => (cat === "All" || cat === "Suggested" || item.category === cat) && (!query || `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())));
  const count = Object.values(connected).filter(Boolean).length;
  const toggle = async (item: Integration) => {
    setBusy(item.app);
    try {
      {
        const before = accounts.filter((a) => a.app === integrationSlug(item.app) && a.status === "ACTIVE").length;
        const result = await startIntegrationConnection(item);
        if ("popup" in result && result.popup) await waitForConnectionRefresh(async () => {
          const state = await loadIntegrationConnections(CATALOG);
          setConnected(state.connectedApps); setAccounts(state.accounts);
          return state.accounts.filter((a) => a.app === integrationSlug(item.app) && a.status === "ACTIVE").length > before;
        }, result.popup);
        toast.success(`${item.name} connected`);
      }
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not connect"); } finally { setBusy(""); }
  };
  const label = (item: Integration) => connected[item.app] ? "Add account" : "Connect";
  const button = (item: Integration, big = false) => <Button variant="ghost" type="button" className={big ? "gx-connect-big" : "gx-pill"} disabled={busy === item.app} onClick={(event) => { event.stopPropagation(); void toggle(item); }}>{busy === item.app ? "…" : label(item)}</Button>;
  const detail = appId ? CATALOG.find((item) => item.app === appId) : undefined;
  if (detail) return <div className="gx-apps gx-sheet" key={detail.id}>
    <button type="button" className="gx-round" aria-label="Close" onClick={() => nav("/settings/apps")}><X size={22} /></button>
    <div className="gx-detail"><span className="gx-logo gx-logo-lg"><IntegrationLogo item={detail} size={44} /></span><h2>{detail.name}</h2><p>{detail.description}</p></div>
    <div className="gx-detail-cta">{button(detail, true)}</div>
    {error && <p className="text-destructive p-4" role="alert">{error}</p>}
    <div className="px-4">{accounts.filter((a) => a.app === integrationSlug(detail.app)).map((account) => <div key={account.id} className="flex items-center gap-3 border-b border-border py-3">
      <span className="min-w-0 flex-1"><strong className="block text-sm break-words">{account.label}</strong><small className="text-muted-foreground">{account.status === "ACTIVE" ? "Connected" : account.status}</small></span>
      <Button variant="ghost" size="icon-sm" aria-label={`Disconnect ${account.label}`} disabled={!!busy} onClick={() => { setBusy(detail.app); void disconnectIntegration(detail, account.id).then(refresh).catch((e) => toast.error(e.message)).finally(() => setBusy("")); }}><Trash2 size={16} /></Button>
    </div>)}</div>
  </div>;
  const row = (item: Integration) => <div key={item.id} className="gx-app-row" role="button" tabIndex={0} onClick={() => nav(`/settings/apps/${encodeURIComponent(item.app)}`)} onKeyDown={(event) => { if (event.key === "Enter") nav(`/settings/apps/${encodeURIComponent(item.app)}`); }}>
    <span className="gx-logo"><IntegrationLogo item={item} size={30} /></span>
    <span className="gx-app-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
    {button(item)}
  </div>;
  return <div className="gx-apps">
    <header className="gx-apps-head"><button type="button" className="gx-round" aria-label="Back" onClick={() => nav("/")}><ChevronLeft size={24} /></button><h1>Connect apps</h1><span className="gx-count">{count} connected</span></header>
    <div className="gx-chips">{cats.map((category) => <button type="button" key={category} data-active={cat === category || (category === "All" && cat === "Suggested")} onClick={() => setCat(category)}>{category}</button>)}</div>
    <div className="gx-apps-scroll">
      {error && <p className="text-destructive p-4" role="alert">{error}</p>}
      {cat === "All" || cat === "Suggested" ? <>
        {!query && <><h3 className="gx-sec">For You <ChevronRight size={18} /></h3>{filtered.slice(0, 4).map(row)}<h3 className="gx-sec">Featured plugins <ChevronRight size={18} /></h3></>}
        {(query ? filtered : filtered.slice(4)).map(row)}
      </> : filtered.map(row)}
    </div>
    <div className="gx-bottom-search"><Search size={20} /><input aria-label="Search apps" placeholder="Search across apps and skills" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
  </div>;
}

function Devices({ nav }: { nav: Nav }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const name = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : "This device";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const signOutOthers = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast.success("Signed out of other devices");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not sign out other devices"); } finally { setBusy(false); }
  };
  return (
    <Shell title="Manage your devices" back={() => nav("/settings")}>
      <Group title="This device">
        <Row icon={<span className="ceyo-device-icon"><Smartphone size={19} /><i /></span>} label={`${name} · This device`} value="Active now" onClick={() => setExpanded((value) => !value)} />
      </Group>
      {expanded && <Group title="Device details"><Row label="Platform" value={name} /><Row label="Time Zone" value={tz} /><Row label="Status" value="Current session" /></Group>}
      <Group><Row label={busy ? "Signing out…" : "Sign out of other devices"} disabled={busy} onClick={() => void signOutOthers()} /></Group>
      <p className="ceyo-note">Your current device stays signed in. Other active sessions are signed out.</p>
    </Shell>
  );
}

function Computer({ nav }: { nav: Nav }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Shell title="Bot Computer" back={() => nav("/settings")}>
      <Group><Row label="Reset Computer" sub="Rebuild from your last saved snapshot. Very recent changes may be lost." danger onClick={() => setConfirming(true)} right={<span />} /></Group>
      <p className="ceyo-note">The one computer your Bots share.</p>
      {confirming && <div className="ceyo-card ceyo-confirm-card"><strong>Reset this computer?</strong><p>This requires a connected bot computer. Recent changes may be lost.</p><div className="hub-form-footer"><button type="button" className="hub-button hub-button-primary" onClick={() => { setConfirming(false); toast.error("No connected bot computer is available to reset"); }}>Reset</button><button type="button" className="hub-button hub-button-secondary" onClick={() => setConfirming(false)}>Cancel</button></div></div>}
      <Group><Row label="Disk space" value="Normal" right={<span />} /></Group>
    </Shell>
  );
}

function Permissions({ nav }: { nav: Nav }) {
  const [preferences, setPreferences] = useState<PermissionPreferences>(DEFAULT_PERMISSIONS);
  const [adding, setAdding] = useState<PermissionRuleKind | null>(null);
  const [text, setText] = useState("");
  useEffect(() => { setPreferences(parsePermissionPreferences(localStorage.getItem(PERMISSIONS_STORAGE_KEY))); }, []);
  const save = (next: PermissionPreferences) => { setPreferences(next); localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(next)); };
  const add = () => {
    if (!adding || !text.trim()) return;
    save(addPermissionRule(preferences, adding, text));
    setText("");
    setAdding(null);
    toast.success("Rule added");
  };
  const section = (kind: PermissionRuleKind, title: string, description: string) => <section className="ceyo-permission-section">
    <div className="ceyo-permission-head"><div><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={() => { setAdding(kind); setText(""); }}>Add Rule</button></div>
    {adding === kind && <form className="ceyo-rule-form" onSubmit={(event) => { event.preventDefault(); add(); }}><input className="ceyo-input" value={text} maxLength={300} onChange={(event) => setText(event.target.value)} placeholder="Describe the action" autoFocus /><div><button type="submit" className="hub-button hub-button-primary" disabled={!text.trim()}>Save rule</button><button type="button" className="hub-button hub-button-secondary" onClick={() => setAdding(null)}>Cancel</button></div></form>}
    <div className="ceyo-rule-list">{preferences[kind].length ? preferences[kind].map((rule, index) => <div className="ceyo-rule" key={`${rule}-${index}`}><span>{rule}</span><button type="button" aria-label={`Delete rule ${rule}`} onClick={() => save(removePermissionRule(preferences, kind, index))}><Trash2 size={16} /></button></div>) : <p>No rules yet</p>}</div>
  </section>;
  return (
    <Shell title="Permissions" back={() => nav("/settings")}>
      <Group><Row label="Auto-Review" sub="Review Ceyo Bot actions based on custom rules" checked={preferences.autoReview} onClick={() => save({ ...preferences, autoReview: !preferences.autoReview })} right={<Toggle on={preferences.autoReview} />} /></Group>
      {section("ask", "Always Ask", "Stop and ask when an action matches these rules")}
      {section("allow", "Allow without Asking", "Continue automatically when an action matches these rules")}
      <p className="ceyo-note ceyo-permission-note">Rules are saved on this device.</p>
    </Shell>
  );
}

const MEMORY_PROMPT = `Export all of my stored memories and any context you've learned about me from past conversations. Preserve my words verbatim where possible, especially for instructions and preferences.\n\nCategories (output in this order):\n1. Instructions: Rules I've explicitly asked you to follow.\n2. Preferences: How I like answers formatted and delivered.\n3. Projects: Ongoing work, goals and important context.\n4. People: Names and relationships that matter to me.\n\nOutput only the memory list.`;

function Memory({ nav }: { nav: Nav }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(MEMORY_PROMPT); toast.success("Prompt copied"); } catch { toast.error("Could not copy the prompt"); }
  };
  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sign in first");
      const { error } = await supabase.from("user_knowledge").insert({ user_id: data.user.id, name: "Imported memory", use_when: "Always", content: text.trim().slice(0, 5000) } as never);
      if (error) throw error;
      setText("");
      toast.success("Memory added");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add memory"); } finally { setSaving(false); }
  };
  return (
    <Shell title="Import Memory" back={() => nav("/settings")}>
      <section className="ceyo-memory-step"><h2>1. Copy this prompt into a chat with your other SI assistant</h2><div className="ceyo-memory-prompt"><p>{MEMORY_PROMPT}</p><button type="button" onClick={() => void copyPrompt()}><Copy size={16} />Copy prompt</button></div></section>
      <section className="ceyo-memory-step"><h2>2. Paste the results below to add them to Ceyo Bot's memory</h2><textarea className="ceyo-input ceyo-textarea" maxLength={5000} placeholder="Paste your memory details here" value={text} onChange={(event) => setText(event.target.value)} /></section>
      <button type="button" className="hub-button hub-button-primary ceyo-wide ceyo-memory-add" disabled={!text.trim() || saving} onClick={() => void add()}>{saving ? "Adding…" : "Add to Memory"}</button>
    </Shell>
  );
}

type SurfaceMode = "black" | "bot";
function applySurface(mode: SurfaceMode) {
  document.documentElement.dataset.ceyoSurface = mode;
  localStorage.setItem("ceyo_surface", mode);
}

function Appearance({ nav }: { nav: Nav }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [surface, setSurface] = useState<SurfaceMode>("black");
  useEffect(() => {
    setMode(getStoredTheme());
    const saved = localStorage.getItem("ceyo_surface") === "bot" ? "bot" : "black";
    setSurface(saved);
    applySurface(saved);
  }, []);
  const options: [ThemeMode, string, ReactNode][] = [["system", "Follow System", <Contrast size={28} />], ["light", "Light", <Sun size={28} />], ["dark", "Dark", <Moon size={28} />]];
  const chooseSurface = (value: SurfaceMode) => { setSurface(value); applySurface(value); };
  return (
    <Shell title="Appearance" back={() => nav("/settings")}>
      <div className="ceyo-theme-grid">{options.map(([value, label, icon]) => <button type="button" key={value} data-active={mode === value} onClick={() => { setTheme(value); setMode(value); }}><span>{icon}</span><strong>{label}</strong></button>)}</div>
      <div className="ceyo-surface-grid">
        <button type="button" data-active={surface === "black"} onClick={() => chooseSurface("black")}><span><i className="ceyo-black-dot" /></span><strong>Black</strong></button>
        <button type="button" data-active={surface === "bot"} onClick={() => chooseSurface("bot")}><span><i className="ceyo-bot-color-dot" /></span><strong>Bot color</strong></button>
      </div>
    </Shell>
  );
}

const LANGUAGES: [string, string][] = [
  ["system", "System"], ["ar", "العربية"], ["zh-CN", "简体中文"], ["zh-TW", "繁體中文"],
  ["en", "English"], ["hi", "हिन्दी"], ["pl", "Polski"], ["es", "Español"],
  ["pt", "Português"], ["ja", "日本語"], ["fr", "Français"], ["ko", "한국어"],
  ["de", "Deutsch"], ["tr", "Türkçe"],
];

function Language({ nav }: { nav: Nav }) {
  const [selected, setSelected] = useState("system");
  useEffect(() => { setSelected(localStorage.getItem("ceyo_language") || "system"); }, []);
  const choose = (code: string) => {
    setSelected(code);
    localStorage.setItem("ceyo_language", code);
    window.dispatchEvent(new CustomEvent("ceyo:language", { detail: code }));
    toast.success("Language saved");
  };
  return (
    <Shell title="Language" back={() => nav("/settings")}>
      <Group>{LANGUAGES.map(([code, label]) => <Row key={code} label={label} onClick={() => choose(code)} right={selected === code ? <Check size={18} /> : <span />} />)}</Group>
      <p className="ceyo-note">Your language choice is saved on this device.</p>
    </Shell>
  );
}

const PLAY_BILLING = "https://play.google.com/store/account/subscriptions";

/** Google Play owns the card, the receipts and the cancellation. */
function Subscription({ nav }: { nav: Nav }) {
  const openBilling = () => window.open(PLAY_BILLING, "_blank", "noopener");
  return (
    <Shell title="Premium" back={() => nav("/settings")}>
      <Group>
        <Row label="Manage subscription in Google Play" sub="Card details are handled outside the app." onClick={openBilling} right={<Ext />} />
        <Row label="Change plan" sub="Change your subscription plan." onClick={() => nav("/settings/plans")} />
        <Row label="Cancel subscription" sub="Cancel your subscription through Google Play." onClick={openBilling} right={<Ext />} />
      </Group>
      <p className="ceyo-sub-note">Ceyo never stores your card. Google Play handles billing, receipts, tax and cancellation, and you can bring a cancelled plan back before the period ends.</p>
    </Shell>
  );
}

function Feedback({ nav }: { nav: Nav }) {
  const live = useWorkspaceStore() as { agents?: { name?: string }[] };
  const [text, setText] = useState("");
  const [bot, setBot] = useState("None");
  const [pick, setPick] = useState(false);
  const names = ["None", ...new Set((live.agents || []).map((a) => a.name).filter(Boolean) as string[])];

  // Opening settings straight from a cold start leaves the bot list empty.
  useEffect(() => {
    if (!(live.agents || []).length) void loadWorkspace();
  }, [live.agents]);

  const send = () => {
    const body = encodeURIComponent(`${text.trim()}\n\nBot: ${bot}`);
    window.location.href = `mailto:support@ceyo.si?subject=Ceyo%20feedback&body=${body}`;
    toast.success("Thanks — your feedback is on its way");
    nav("/settings");
  };

  return (
    <Shell title="Send Feedback" back={() => nav("/settings")}>
      <div className="ceyo-fb">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened? What did you expect?" />
        <p>We value all feedback, whether it&apos;s a bug, an idea, or a question.</p>
        <span className="ceyo-fb-label">Was your issue with a specific Bot?</span>
        <button type="button" className="ceyo-fb-pick" aria-expanded={pick} onClick={() => setPick((v) => !v)}>
          <span>Bot</span>
          <span>{bot} <ChevronsUpDown size={16} /></span>
        </button>
        {pick && (
          <div className="ceyo-fb-list">
            {names.map((n) => (
              <button key={n} type="button" onClick={() => { setBot(n); setPick(false); }}>{n}</button>
            ))}
          </div>
        )}
      </div>
      <div className="ceyo-fb-foot">
        <button type="button" className="ceyo-fb-send" disabled={!text.trim()} onClick={send}>Send Feedback</button>
      </div>
    </Shell>
  );
}

export default function CeyoSettings() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const nav: Nav = (to) => navigate(to);
  const [, , section, sub] = pathname.split("/");
  switch (section) {
    case "account": return <Account nav={nav} />;
    case "usage": return <Usage nav={nav} />;
    case "plans": return <Plans nav={nav} />;
    case "subscription": return <Subscription nav={nav} />;
    case "feedback": return <Feedback nav={nav} />;
    case "vault": return <Vault_ nav={nav} />;
    case "apps": return <Apps nav={nav} appId={sub ? decodeURIComponent(sub) : undefined} />;
    case "devices": return <Devices nav={nav} />;
    case "computer": return <Computer nav={nav} />;
    case "permissions": return <Permissions nav={nav} />;
    case "memory": return <Memory nav={nav} />;
    case "appearance": return <Appearance nav={nav} />;
    case "language": return <Language nav={nav} />;
    default: return <Main nav={nav} />;
  }
}
