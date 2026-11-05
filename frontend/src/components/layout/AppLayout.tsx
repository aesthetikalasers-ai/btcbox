import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { cn } from "../../lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="flex h-dvh min-h-[100dvh] w-full overflow-hidden bg-brand-bg text-brand-text">
      <div className="hidden h-full w-[248px] shrink-0 shadow-[1px_0_0_0_rgba(255,255,255,0.05)] lg:z-20 lg:block"><Sidebar /></div>
      {isMobileMenuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      <div className={cn("fixed inset-y-0 left-0 z-50 w-[min(84vw,280px)] transform bg-brand-sidebar shadow-2xl transition-transform duration-300 ease-out lg:hidden",isMobileMenuOpen ? "translate-x-0" : "-translate-x-full")}>
        <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
      </div>
      <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
          <footer className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 pb-4 pt-2 text-center text-[11px] text-brand-text-muted" aria-label="Open source attribution">
            <span>TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.</span>
            <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline decoration-brand-border underline-offset-2 hover:text-brand-text-secondary">TradingView</a>
            <span aria-hidden="true">·</span>
            <a href="/NOTICE" className="underline decoration-brand-border underline-offset-2 hover:text-brand-text-secondary">Notices</a>
            <a href="/LICENSE-Lightweight-Charts" className="underline decoration-brand-border underline-offset-2 hover:text-brand-text-secondary">License</a>
          </footer>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
