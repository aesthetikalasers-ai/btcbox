import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { SiteFooter } from "./SiteFooter";
import { useI18n } from "../../lib/i18n";
import { DEMO_PREVIEW_ACTIVE, exitDemoPreview } from "../../lib/demoPreview";
import { useNavigationTier } from "../../lib/navigation";

/**
 * Renders the shared application shell and coordinates responsive navigation.
 * Resets the content scroll position when routes change.
 *
 * The shell is tiered:
 * - top-level pages keep the global logo header and the fixed 5-tab bottom nav;
 * - sub-pages get neither, and render their own `SubPageLayout` bar instead so the
 *   back affordance and page title become the primary navigation.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const location = useLocation();
  const tier = useNavigationTier(location.pathname);
  const isSubPage = tier === "sub";
  // The desktop trading terminal owns its viewport: it locks to 100dvh, hides
  // the trailing footer, and only its own panels scroll. Below 1280px the trade
  // page keeps the normal document flow (the data attribute is CSS-gated).
  const isTerminalRoute = /^\/trade\/[^/]+$/i.test(location.pathname);
  const mainRef = useRef<HTMLElement>(null);

  // 路由变化时重置滚动条
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="flex h-dvh min-h-screen min-h-[100dvh] w-full overflow-hidden bg-brand-bg text-brand-text">
      <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {/* Sub-pages own their header through SubPageLayout, so the global logo
            header and the bottom tab bar are intentionally omitted for that tier. */}
        {!isSubPage && <Topbar />}
        {false && DEMO_PREVIEW_ACTIVE && <div role="status" className="flex h-6 items-center gap-2 border-b border-brand-border-subtle bg-brand-surface-2 px-3 py-1 leading-6 text-[10px] sm:px-5">
          <span className="text-brand-text-muted capitalize">demo</span>
          <span className="text-brand-text text-nounderline hover:opacity-80 transition-opacity">Preview</span>
          <button type="button" onClick={exitDemoPreview} className="min-h-5 min-w-8 rounded-md px-1.5 text-xs font-medium text-brand-text underline underline-offset-1 hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60">{t("Exit")}</button>
        </div>}
        <main ref={mainRef} tabIndex={-1} data-terminal-route={isTerminalRoute ? "true" : undefined} className={`min-h-0 flex-1 overflow-y-auto focus:outline-none ${isSubPage ? "pb-0" : "pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0"}`}>
          {children}
          {/* Footer lives inside the scroll container so it trails the content
              instead of being pinned above the mobile tab bar. The terminal
              route hides it: a locked trading viewport has no room for it. */}
          {!isSubPage && !isTerminalRoute && <SiteFooter />}
        </main>
      </div>
      {!isSubPage && <BottomNav />}
    </div>
  );
}