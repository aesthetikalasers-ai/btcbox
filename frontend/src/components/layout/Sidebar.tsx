import { NavLink } from "react-router-dom";
import { ArrowLeftRight, ChartNoAxesCombined, ClipboardList, Headset, House, Settings, Sprout, UserRound, Wallet, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";
import { BrandLogo } from "../BrandLogo";

const primary = [
  { to: "/home", label: "Home", icon: House, active: "border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan shadow-[inset_3px_0_0_0_var(--color-brand-cyan)]" },
  { to: "/markets", label: "Markets", icon: ChartNoAxesCombined, active: "border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan shadow-[inset_3px_0_0_0_var(--color-brand-cyan)]" },
  { to: "/trade-hub", label: "Trade", icon: ArrowLeftRight, active: "border-brand-info/25 bg-brand-info/10 text-brand-info shadow-[inset_3px_0_0_0_var(--color-brand-info)]" },
  { to: "/assets", label: "Assets", icon: Wallet, active: "border-brand-teal/25 bg-brand-teal/10 text-brand-teal shadow-[inset_3px_0_0_0_var(--color-brand-teal)]" },
  { to: "/me", label: "My", icon: UserRound, active: "border-brand-indigo/25 bg-brand-indigo/10 text-brand-indigo shadow-[inset_3px_0_0_0_var(--color-brand-indigo)]" },
];
const secondary = [
  { to: "/orders", label: "Orders", icon: ClipboardList, active: "bg-brand-violet/10 text-brand-violet" },
  { to: "/earn", label: "Earn", icon: Sprout, active: "bg-brand-warning/10 text-brand-warning" },
  { to: "/support", label: "Support", icon: Headset, active: "bg-brand-indigo/10 text-brand-indigo" },
  { to: "/settings", label: "Settings", icon: Settings, active: "bg-brand-indigo/10 text-brand-indigo" },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  return <aside className="flex h-full w-full shrink-0 flex-col border-r border-brand-border bg-brand-sidebar lg:w-[248px]">
    <div className="mt-1 flex h-16 items-center justify-between px-5"><NavLink to="/home" className="min-w-0" onClick={onClose}><BrandLogo /></NavLink>{onClose && <button aria-label={t("Close navigation")} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-text-muted transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent lg:hidden"><X className="h-5 w-5"/></button>}</div>
    <nav aria-label={t("Primary navigation")} className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
      <div className="space-y-1">{primary.map(({to,label,icon:Icon,active})=><NavLink key={to} to={to} onClick={onClose} className={({isActive})=>cn("flex min-h-11 h-auto min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold leading-tight transition-colors",isActive?active:"border-transparent text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text")}><Icon className="h-[18px] w-[18px] shrink-0 opacity-90"/><span className="min-w-0 break-words">{t(label)}</span></NavLink>)}</div>
      <div><p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[.16em] text-brand-text-muted">{t("Manage")}</p><div className="space-y-1">{secondary.map(({to,label,icon:Icon,active})=><NavLink key={to} to={to} onClick={onClose} className={({isActive})=>cn("flex min-h-10 h-auto min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold leading-tight transition-colors",isActive?active:"text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text")}><Icon className="h-4 w-4 shrink-0"/><span className="min-w-0 break-words">{t(label)}</span></NavLink>)}</div></div>
    </nav>
    <div className="m-4 rounded-xl border border-brand-warning/20 bg-brand-warning/5 p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-warning"/><span className="text-xs font-semibold text-brand-warning">{t("Preview · API verification pending")}</span></div></div>
  </aside>;
}
