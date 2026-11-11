import { cn } from "../lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  showExchange?: boolean;
  hideNameBelow?: boolean;
  className?: string;
};

// Official white artwork, unchanged. Transparent canvas is preserved; no filter,
// crop or colored plate is applied to the original mark.
export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return <span className={cn("relative inline-block h-11 shrink-0 align-middle", compact ? "w-[108px] min-[360px]:w-[132px]" : "w-[166px]", className)}>
    <img src="/brand/btcbox-logo-white.png" alt="BTCBOX" width="1113" height="689"
      className="pointer-events-none absolute left-0 top-1/2 h-auto w-full -translate-y-1/2" decoding="async" />
  </span>;
}
