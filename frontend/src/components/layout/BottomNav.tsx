import { NavLink } from "react-router-dom";
import { ArrowLeftRight, ChartNoAxesCombined, House, UserRound, Wallet } from "lucide-react";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";

const items = [
  { to: "/home", label: "Home", icon: House, active: "bg-white/[0.045] text-brand-text" },
  { to: "/markets", label: "Markets", icon: ChartNoAxesCombined, active: "bg-white/[0.045] text-brand-text" },
  { to: "/trade-hub", label: "Trade", icon: ArrowLeftRight, active: "bg-white/[0.045] text-brand-text" },
  { to: "/assets", label: "Assets", icon: Wallet, active: "bg-white/[0.045] text-brand-text" },
  { to: "/me", label: "My", icon: UserRound, active: "bg-white/[0.045] text-brand-text" },
];

export function BottomNav() {
  const { t } = useI18n();
  return <nav aria-label={t("Primary navigation")} className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-brand-border bg-brand-sidebar/95 shadow-[0_-8px_28px_rgba(0,0,0,0.18)] px-1 pt-2 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
    {items.map(({ to, label, icon: Icon, active }) => <NavLink key={to} to={to} className={({ isActive }) => cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-sidebar sm:text-xs", isActive ? active : "text-brand-text-muted hover:text-brand-text-secondary")}><Icon className="h-5 w-5 shrink-0"/><span className="max-w-full truncate px-0.5 text-center">{t(label)}</span></NavLink>)}
  </nav>;
}
