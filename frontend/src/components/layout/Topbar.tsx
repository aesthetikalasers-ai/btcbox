import { Search, Bell, User, Radio, Menu } from "lucide-react";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-brand-border bg-brand-bg px-3 sm:px-4 md:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onMenuClick && <button aria-label="Open navigation" onClick={onMenuClick} className="rounded-lg p-1.5 text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text lg:hidden"><Menu className="h-5 w-5"/></button>}
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-text-muted"/>
          <input type="search" aria-label="Search BTCBOX" placeholder="Search" className="h-10 w-[min(34vw,180px)] rounded-xl border border-brand-border-subtle bg-[#121316] pl-9 pr-3 text-[13px] text-brand-text shadow-inner placeholder:text-brand-text-muted focus:border-brand-border focus:outline-none sm:w-[190px] md:w-[240px]"/>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden text-[11px] text-brand-text-muted lg:inline">Markets</span>
        <div className="flex h-7 items-center gap-1.5 rounded-full border border-brand-border-subtle bg-[#151618] px-2.5">
          <Radio className="h-3.5 w-3.5 text-profit"/>
          <span className="hidden text-[12px] font-medium text-brand-text sm:inline">Preview</span>
        </div>
        <button aria-label="Notifications" className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent transition-colors hover:border-brand-border-subtle hover:bg-brand-surface"><Bell className="h-4 w-4 text-brand-text-secondary"/></button>
        <button aria-label="Account" className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-border-subtle bg-[#151618] transition-colors hover:bg-brand-surface-hover"><User className="h-4 w-4 text-brand-text-secondary"/></button>
      </div>
    </header>
  );
}
