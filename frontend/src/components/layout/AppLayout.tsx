import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";

export function AppLayout({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);
  return (
    <div className="flex h-dvh min-h-[100dvh] w-full overflow-hidden bg-brand-bg text-brand-text">
      <div className="hidden h-full w-[248px] shrink-0 shadow-[1px_0_0_0_rgba(255,255,255,0.05)] lg:z-20 lg:block"><Sidebar /></div>
      {isMobileMenuOpen && <button type="button" aria-label={t("Close navigation")} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      <div id="mobile-navigation" role={isMobileMenuOpen ? "dialog" : undefined} aria-modal={isMobileMenuOpen ? true : undefined} aria-hidden={!isMobileMenuOpen} inert={!isMobileMenuOpen} aria-label={t("Mobile navigation")} className={cn("fixed inset-y-0 left-0 z-50 w-[min(84vw,280px)] transform bg-brand-sidebar shadow-2xl transition-transform duration-300 ease-out lg:hidden",isMobileMenuOpen ? "translate-x-0" : "-translate-x-full")}>
        <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
      </div>
      <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar menuOpen={isMobileMenuOpen} onMenuClick={() => setIsMobileMenuOpen((open) => !open)} />
        <main className="min-h-0 flex-1 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
