import { cn } from "../lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  /** Kept for call-site compatibility; variant selection drives the artwork instead. */
  showExchange?: boolean;
  /**
   * Which official asset to render. All three are unmodified official PNGs
   * (see public/brand/README.md) — recoloring is prohibited by the brand terms.
   * - "white": official white wordmark, highest contrast on the dark app chrome.
   * - "color": official full-color horizontal wordmark, for light surfaces.
   * - "icon":  official square diamond mark, for centered splash/auth/loading spots.
   * - "mark":  header brand mark — the diamond-only icon at header scale.
   */
  variant?: "white" | "color" | "icon" | "mark";
  className?: string;
};

const BRAND_ASSETS = {
  white: { src: "/brand/btcbox-logo-white.png", width: 1113, height: 689 },
  color: { src: "/brand/btcbox-logo.png", width: 1667, height: 588 },
  icon: { src: "/brand/btcbox-icon.png", width: 1027, height: 1027 },
  // Header brand mark: same official diamond artwork as "icon", rendered at header scale.
  mark: { src: "/brand/btcbox-icon.png", width: 1027, height: 1027 },
} as const;

// Height-driven sizing (h-* + w-auto object-contain) keeps the aspect ratio locked
// by the intrinsic PNG dimensions, so no cropping or distortion can occur.
const SIZE_CLASSES = {
  icon: "h-14 w-14 sm:h-16 sm:w-16",
  mark: "h-9 w-9 sm:h-10 sm:w-10", // header brand mark: diamond-only, no wordmark
  compact: "h-10 sm:h-12", // horizontal wordmark: 40–48px tall
  full: "h-10 sm:h-12",
} as const;

export function BrandLogo({ compact = false, variant = "white", className }: BrandLogoProps) {
  // Fall back to the icon artwork if a variant is ever added without a brand asset,
  // so a missing entry can never crash the whole React tree again.
  const asset = BRAND_ASSETS[variant] ?? BRAND_ASSETS.icon;
  const sizeClass =
    variant === "icon" || variant === "mark"
      ? variant === "mark"
        ? SIZE_CLASSES.mark
        : SIZE_CLASSES.icon
      : compact
        ? SIZE_CLASSES.compact
        : SIZE_CLASSES.full;
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center align-middle", className)}>
      <img src={asset.src} alt="BTCBOX" width={asset.width} height={asset.height}
        className={cn("pointer-events-none w-auto object-contain", sizeClass)} decoding="async" />
    </span>
  );
}
