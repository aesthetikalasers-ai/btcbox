import { NavLink } from "react-router-dom";
import { ArrowLeftRight, ChartNoAxesCombined, ClipboardList, Headset, House, Settings, Sprout, UserRound, Wallet, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";
import { BrandLogo } from "../BrandLogo";

const primary = [
  { to: "/home", label: "Home", icon: House },
  { to: "/markets", label: "Markets", icon: ChartNoAxesCombined },
  { to: "/trade-hub", label: "Trade", icon: ArrowLeftRight },
  { to: "/assets", label: "Assets", icon: Wallet },
  { to: "/me", label: "My", icon: UserRound },
];
const secondary = [
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/earn", label: "Earn", icon: Sprout },
  { to: "/support", label: "Support", icon: Headset },
  { to: "/settings", label: "Settings", icon: Settings },
];

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-sidebar";

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  return <aside className="flex h-full w-full shrink-0 flex-col border-r border-brand-border bg-brand-sidebar lg:w-[248px]">
    <div className="mt-1 flex h-16 items-center justify-between px-5"><NavLink to="/home" className="min-w-0" onClick={onClose}><BrandLogo /></NavLink>{onClose && <button aria-label={t("Close navigation")} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-text-muted transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent lg:hidden"><X className="h-5 w-5"/></button>}</div>
    <nav aria-label={t("Primary navigation")} className="flex-1 space-y-7 overflow-y-auto px-3 py-5"><div className="space-y-1">{primary.map(({to,label,icon:Icon})=><NavLink key={to} to={to} onClick={onClose} className={({isActive})=>cn("flex min-h-11 h-auto min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold leading-tight transition-colors",isActive?"border-brand-accent/25 bg-brand-accent/10 text-white shadow-[inset_3px_0_0_0_var(--color-brand-accent)]":"border-transparent text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text")}><Icon className="h-[18px] w-[18px] shrink-0 opacity-90"/><span className="min-w-0 break-words">{t(label)}</span></NavLink>)}</div><div><p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[.16em] text-brand-text-muted">{t("Manage")}</p><div className="space-y-1">{secondary.map(({to,label,icon:Icon})=><NavLink key={to} to={to} onClick={onClose} className={({isActive})=>cn("flex min-h-10 h-auto min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold leading-tight transition-colors",isActive?"bg-brand-surface-2 text-brand-text":"text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text")}><Icon className="h-4 w-4 shrink-0"/><span className="min-w-0 break-words">{t(label)}</span></NavLink>)}</div></div></nav>
  </aside>;
}
