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
  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-brand-border bg-brand-sidebar pt-[env(safe-area-inset-top)] lg:w-[224px]">
      <div className="mt-1 flex h-16 items-center justify-between px-5">
        <NavLink to="/home" className="min-w-0" onClick={onClose}><BrandLogo /></NavLink>
        {onClose && (
          <button type="button" aria-label={t("Close navigation")} onClick={onClose} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-text-muted transition-colors hover:bg-brand-surface-hover lg:hidden", focusRing)}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav aria-label={t("Primary navigation")} className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
        <div className="space-y-1">
          {primary.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => cn(
              "group flex min-h-11 h-auto min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold leading-tight transition-all duration-200",
              focusRing,
              isActive && "is-active",
              isActive ? "border-brand-accent/25 bg-brand-accent/10 text-brand-text" : "border-transparent text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text",
            )}>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", "text-current")}><Icon className="h-[17px] w-[17px] opacity-95" /></span>
              <span className="min-w-0 break-words">{t(label)}</span>
              <span aria-hidden="true" className={cn("ml-auto h-1.5 w-1.5 shrink-0 rounded-full opacity-0 transition-opacity group-[.is-active]:opacity-100", to === "/trade-hub" ? "bg-brand-violet" : to === "/assets" ? "bg-brand-teal" : to === "/me" ? "bg-brand-info" : "bg-brand-cyan")} />
            </NavLink>
          ))}
        </div>
        <div>
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[.16em] text-brand-text-muted">{t("Manage")}</p>
          <div className="space-y-1">
            {secondary.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => cn(
                "group flex min-h-11 h-auto min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-[13px] font-semibold leading-tight transition-all duration-200",
                focusRing,
                isActive ? (to === "/earn" ? "border-brand-orange/20 bg-brand-orange/[0.07] text-brand-text" : to === "/support" ? "border-brand-indigo/20 bg-brand-indigo/[0.07] text-brand-text" : "border-brand-info/20 bg-brand-info/[0.07] text-brand-text") : "border-transparent text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text",
              )}>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", to === "/earn" ? "text-brand-text-muted" : to === "/support" ? "text-brand-text-muted" : "text-brand-text-muted")}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 break-words">{t(label)}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
