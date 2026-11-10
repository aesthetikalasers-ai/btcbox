import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { useI18n } from "../../lib/i18n";

export function AppLayout({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useI18n();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  const menuTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setIsMobileMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return (
    <Dialog.Root open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
    <div className="flex h-dvh min-h-screen min-h-[100dvh] w-full overflow-hidden bg-brand-bg text-brand-text">
      <div className="hidden h-full w-[224px] shrink-0 lg:z-20 lg:block"><Sidebar /></div>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 lg:hidden" />
        <Dialog.Content id="mobile-navigation" aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!window.matchMedia("(min-width: 1024px)").matches) menuTrigger.current?.focus();
          }}
          className="fixed inset-y-0 left-0 z-50 w-[min(84vw,280px)] bg-brand-sidebar shadow-2xl lg:hidden">
          <Dialog.Title className="sr-only">{t("Mobile navigation")}</Dialog.Title>
          <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
      <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar menuButtonRef={menuTrigger} menuOpen={isMobileMenuOpen} onMenuClick={() => setIsMobileMenuOpen((open) => !open)} />
        <main ref={mainRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto pb-[calc(60px+env(safe-area-inset-bottom))] focus:outline-none lg:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
    </Dialog.Root>
  );
}
