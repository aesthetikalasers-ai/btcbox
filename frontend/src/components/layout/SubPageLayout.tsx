import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";
import { SubPageNav } from "./SubPageNav";

/**
 * Layout wrapper for sub-pages (Orders, Deposit/Withdraw, Settings, Chart details).
 *
 * Responsibilities:
 * - Replaces the global logo header with the secondary navigation bar.
 * - Removes the bottom 5-tab navigation and the space it used to reserve.
 * - Owns a single scroll container so the header can stay pinned while content
 *   scrolls, matching native app behaviour.
 * - Handles dynamic mobile viewport height with `100dvh`, falling back to `100vh`
 *   for browsers without dynamic viewport support, and honours both top and bottom
 *   safe-area insets (notch / home indicator).
 */
export function SubPageLayout({ title, backLabel, actions, children, className, contentClassName, sticky = true }: {
  title: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  sticky?: boolean;
}) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Reset scroll on route change, mirroring the global shell's behaviour.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div
      className={cn(
        // dvh avoids the mobile URL-bar jump; vh is the fallback for older engines.
        "bf-subpage relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-brand-bg text-brand-text",
        className,
      )}
      data-layout-tier="sub"
    >
      <SubPageNav title={title} backLabel={backLabel} actions={actions} sticky={sticky} />
      <main
        ref={mainRef}
        tabIndex={-1}
        className={cn(
          // pb-safe replaces the old 60px bottom-nav reservation, which sub-pages no longer need.
          "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] focus:outline-none",
          contentClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
