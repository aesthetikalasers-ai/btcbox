import { NavLink } from "react-router-dom";
import { ArrowLeftRight, ChartNoAxesCombined, ClipboardList, Headset, House, Settings, Sprout, UserRound, Wallet, X } from "lucide-react";
import { cn } from "../../lib/utils";

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

export function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-brand-border bg-brand-sidebar lg:w-[248px]">
      <div className="group mt-1 flex h-14 items-center justify-between px-5">
        <NavLink to="/home" className="flex items-center gap-3" onClick={onClose}>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-[#33343A] to-[#0B0C0E] shadow-lg">
            <div className="h-3.5 w-3.5 rotate-45 rounded-[4px] bg-gradient-to-br from-white via-[#E2E2E8] to-[#80808A]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-[17px] font-semibold tracking-tight text-transparent">BTCBOX</span>
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-zinc-300">EXCHANGE</span>
          </div>
        </NavLink>
        {onClose && <button aria-label="Close navigation" onClick={onClose} className="rounded-lg p-1.5 text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text lg:hidden"><X className="h-5 w-5" /></button>}
      </div>
      <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-5">
        <div className="space-y-1">{primary.map(({to,label,icon:Icon})=><NavLink key={to} to={to} onClick={onClose} className={({isActive})=>cn("flex h-10 items-center gap-3 rounded-lg border px-3 text-[13px] font-medium transition-colors",isActive?"border-brand-border-subtle bg-brand-surface-2 text-brand-text":"border-transparent text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text")}><Icon className="h-4 w-4 opacity-80"/>{label}</NavLink>)}</div>
        <div><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-text-muted">Manage</p><div className="space-y-1">{secondary.map(({to,label,icon:Icon})=><NavLink key={to} to={to} onClick={onClose} className={({isActive})=>cn("flex h-9 items-center gap-3 rounded-lg px-3 text-[12px] font-medium transition-colors",isActive?"bg-brand-surface-2 text-brand-text":"text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text-secondary")}><Icon className="h-4 w-4"/>{label}</NavLink>)}</div></div>
      </nav>
      <div className="p-5"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-profit"/><span className="text-[11px] font-medium text-brand-text-muted">Preview data · API pending</span></div></div>
    </aside>
  );
}
