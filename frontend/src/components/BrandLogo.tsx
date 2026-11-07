import { cn } from "../lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  showExchange?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, showExchange = true, className }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)} aria-label="BTCBOX Exchange">
      <span className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-accent/35 bg-gradient-to-br from-brand-accent/30 via-brand-surface-2 to-brand-sidebar shadow-sm",
        compact ? "h-8 w-8" : "h-9 w-9"
      )}>
        <svg viewBox="0 0 100 100" className={compact ? "h-[19px] w-[19px]" : "h-[22px] w-[22px]"} fill="none" aria-hidden="true">
          <path d="M82 36 L90 50 L50 90 L10 50 L50 10 L68 24" stroke="currentColor" className="text-white" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 45 L50 68 L97 25 L50 80 L21 55 Z" fill="currentColor" className="text-white" />
        </svg>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
        <span className={cn(
          "bg-gradient-to-b from-white to-sky-200 bg-clip-text font-bold tracking-tight text-transparent",
          compact ? "text-lg" : "text-xl"
        )}>BTCBOX</span>
        {showExchange && <span className="rounded border border-brand-accent/30 bg-brand-accent/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-brand-accent">EXCHANGE</span>}
      </span>
    </span>
  );
}
