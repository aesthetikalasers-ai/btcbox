import { NavLink } from "react-router-dom";
import { ArrowLeftRight, ChartNoAxesCombined, ClipboardList, Headset, House, Settings, Sprout, UserRound, Wallet, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";
import { BrandLogo } from "../BrandLogo";

const primary = [
  { to: "/home", label: "Home", icon: House, active: "border border-brand-border-subtle bg-brand-border-subtle text-brand-text shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]" },
  { to: "/markets", label: "Markets", icon: ChartNoAxesCombined, active: "border border-brand-border-subtle bg-brand-border-subtle text-brand-text shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]" },
  { to: "/trade-hub", label: "Trade", icon: ArrowLeftRight, active: "border border-brand-border-subtle bg-brand-border-subtle text-brand-text shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]" },
  { to: "/assets", label: "Assets", icon: Wallet, active: "border border-brand-border-subtle bg-brand-border-subtle text-brand-text shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]" },
  { to: "/me", label: "My", icon: UserRound, active: "border border-brand-border-subtle bg-brand-border-subtle text-brand-text shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]" },
];
const secondary = [
  { to: "/orders", label: "Orders", icon: ClipboardList, active: "border border-brand-border-subtle bg-brand-border-subtle text-brand-text" },
  { to: "/earn", label: "Earn", icon: Sprout, active: "border border-brand-border-subtle bg-brand-border-subtle text-brand-text" },
  { to: "/support", label: "Support", icon: Headset, active: "border border-brand-border-subtle bg-brand-border-subtle text-brand-text" },
  { to: "/settings", label: "Settings", icon: Settings, active: "border border-brand-border-subtle bg-brand-border-subtle text-brand-text" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  return <aside className="flex h-full w-full shrink-0 flex-col border-r border-brand-border bg-brand-sidebar lg:w-[248px]">
    <div className="mt-1 flex h-16 items-center justify-between px-5"><NavLink to="/home" className="min-w-0" onClick={onClose}><BrandLogo /></NavLink>{onClose && <button aria-label={t("Close navigation")} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-text-muted transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent lg:hidden"><X className="h-5 w-5"/></button>}</div>
    <nav aria-label={t("Primary navigation")} className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
      <div className="space-y-1">{primary.map(({to,label,icon:Icon,active})=><NavLink key={to} to={to} onClick={onClose} className={({isActive})=>cn("flex min-h-11 h-auto min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-sidebar",isActive?active:"border-transparent text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text")}><Icon className="h-[18px] w-[18px] shrink-0 opacity-90"/><span className="min-w-0 break-words">{t(label)}</span></NavLink>)}</div>
      <div><p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[.16em] text-brand-text-muted">{t("Manage")}</p><div className="space-y-1">{secondary.map(({to,label,icon:Icon,active})=><NavLink key={to} to={to} onClick={onClose} className={({isActive})=>cn("flex min-h-11 h-auto min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-[13px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-sidebar",isActive?active:"text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text")}><Icon className="h-4 w-4 shrink-0"/><span className="min-w-0 break-words">{t(label)}</span></NavLink>)}</div></div>
    </nav>
  </aside>;
}
