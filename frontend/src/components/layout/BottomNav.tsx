import { NavLink } from "react-router-dom";
import { ArrowLeftRight, ChartNoAxesCombined, House, UserRound, Wallet } from "lucide-react";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";

const items = [
  { to: "/home", label: "Home", icon: House, active: "bg-brand-accent/10 text-brand-accent" },
  { to: "/markets", label: "Markets", icon: ChartNoAxesCombined, active: "bg-brand-accent/10 text-brand-accent" },
  { to: "/trade", label: "Trade", icon: ArrowLeftRight, active: "bg-brand-accent/10 text-brand-accent" },
  { to: "/assets", label: "Assets", icon: Wallet, active: "bg-brand-accent/10 text-brand-accent" },
  { to: "/me", label: "My", icon: UserRound, active: "bg-brand-accent/10 text-brand-accent" },
];

export function BottomNav() {
  const { t } = useI18n();
  return <nav aria-label={t("Primary navigation")} className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(60px+env(safe-area-inset-bottom))] grid-cols-5 items-center border-t border-brand-border bg-brand-sidebar/95 shadow-[0_-8px_28px_rgba(0,0,0,0.18)] px-1 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}>
    {items.map(({ to, label, icon: Icon, active }) => <NavLink key={to} to={to} className={({ isActive }) => cn("flex h-full min-w-0 flex-col items-center justify-center gap-1 rounded-none text-[10px] font-semibold leading-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-sidebar sm:text-xs", isActive ? active : "text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text-secondary")}><Icon className="h-5 w-5 shrink-0"/><span className="max-w-full truncate px-0.5 text-center">{t(label)}</span></NavLink>)}
  </nav>;
}
