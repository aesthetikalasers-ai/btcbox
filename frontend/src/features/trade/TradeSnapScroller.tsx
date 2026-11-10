import { useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * Horizontally scrollable card groups with CSS scroll-snap (no JS scroll library).
 * Pure CSS: `scroll-snap-type: x mandatory` + each segment `scroll-snap-align: start`.
 * A small dot indicator tracks the active segment. On md+ the parent renders a grid instead.
 */
export function TradeSnapScroller({ segments, ariaLabel }: { segments: ReactNode[]; ariaLabel: string }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.scrollWidth === 0) return;
    const idx = Math.round((el.scrollLeft / el.scrollWidth) * segments.length);
    setActive(Math.max(0, Math.min(segments.length - 1, idx)));
  };

  return (
    <div className="md:hidden">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        aria-label={ariaLabel}
        className="trade-snap-x flex snap-x snap-mandatory overflow-x-auto"
      >
        {segments.map((seg, i) => (
          <div key={i} className="w-[92%] shrink-0 snap-start px-3 first:pl-3 last:pr-[8%]">
            {seg}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-center gap-1.5" aria-hidden="true">
        {segments.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              active === i ? "w-5 bg-brand-violet" : "w-1.5 bg-brand-border-strong",
            )}
          />
        ))}
      </div>
    </div>
  );
}
