import type { CSSProperties } from "react";
import { cn } from "../lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  /** Kept for call-site compatibility; variant selection drives the artwork instead. */
  showExchange?: boolean;
  /**
   * Which official asset to render. All three are unmodified official PNGs
   * (see public/brand/README.md) — recoloring is prohibited by the brand terms.
   * - "white": official white wordmark (diamond + BTCBOX), highest contrast on dark chrome.
   * - "color": official full-color horizontal wordmark, for light surfaces.
   * - "icon":  official stacked mark (diamond over BTCBOX), for splash/auth spots.
   * - "mark":  header brand mark — same stacked artwork at header scale.
   */
  variant?: "white" | "color" | "icon" | "mark";
  /** Explicit size ladder; falls back to the per-variant default when omitted. */
  size?: "xs" | "sm" | "md" | "lg";
  /**
   * Product lockup rendered next to the artwork.
   * - "exchange": artwork only (BTCBOX Exchange is the default host product).
   * - "wallet":   artwork + "BTCBOX / Wallet" eyebrow, for the independent wallet surface.
   */
  product?: "exchange" | "wallet";
  className?: string;
};

const BRAND_ASSETS = {
  white: { src: "/brand/btcbox-logo-white.png", width: 1113, height: 689 },
  color: { src: "/brand/btcbox-logo.png", width: 1667, height: 588 },
  icon: { src: "/brand/btcbox-icon.png", width: 1027, height: 1027 },
  // Header brand mark: same official artwork as "icon", rendered at header scale.
  mark: { src: "/brand/btcbox-icon.png", width: 1027, height: 1027 },
} as const;

type Variant = keyof typeof BRAND_ASSETS;
type LogoSize = NonNullable<BrandLogoProps["size"]>;

/**
 * Transparent-margin compensation, measured from the opaque pixel bounds of the
 * shipped files (see .brand-logo-ink in index.css).
 *
 * - inkRatio:    visible ink height / canvas height, used to scale the artwork up
 *                so the *visible* logo matches the requested box size.
 * - offsetRatio: (top padding - bottom padding) / canvas height, used to keep the
 *                ink optically centered inside the box.
 */
const TRIM = {
  // btcbox-logo-white.png 1113x689: ink y 213..426
  white: { inkRatio: 213 / 689, offsetRatio: (213 - 263) / 689 },
  // btcbox-icon.png 1027x1027: ink y 57..928
  icon: { inkRatio: 871 / 1027, offsetRatio: (57 - 99) / 1027 },
} as const;

/** Height-driven sizing; w-auto + object-contain keeps the intrinsic aspect ratio locked. */
const VARIANT_SIZE_CLASSES: Record<Variant, Record<LogoSize, string>> = {
  // Stacked mark (diamond over wordmark): the phone header needs a readable diamond.
  mark: {
    xs: "h-9 w-9",
    sm: "h-10 w-10",
    md: "h-12 w-12 sm:h-14 sm:w-14",
    lg: "h-16 w-16 sm:h-20 sm:w-20",
  },
  icon: {
    xs: "h-10 w-10",
    sm: "h-12 w-12",
    md: "h-14 w-14 sm:h-16 sm:w-16",
    lg: "h-20 w-20 sm:h-24 sm:w-24",
  },
  // Horizontal wordmark (diamond + BTCBOX).
  white: {
    xs: "h-8",
    sm: "h-10",
    md: "h-12 sm:h-14",
    lg: "h-16 sm:h-20",
  },
  color: {
    xs: "h-8",
    sm: "h-10",
    md: "h-12 sm:h-14",
    lg: "h-16 sm:h-20",
  },
};

const DEFAULT_SIZE: Record<Variant, LogoSize> = {
  mark: "sm",
  icon: "md",
  white: "sm",
  color: "sm",
};

function trimFor(variant: Variant) {
  return variant === "white" || variant === "color" ? TRIM.white : TRIM.icon;
}

export function BrandLogo({
  compact = false,
  variant = "white",
  size,
  product = "exchange",
  className,
}: BrandLogoProps) {
  // Fall back to the icon artwork if a variant is ever added without a brand asset,
  // so a missing entry can never crash the whole React tree again.
  const resolvedVariant: Variant = variant in BRAND_ASSETS ? variant : "icon";
  const asset = BRAND_ASSETS[resolvedVariant];
  // `compact` is the legacy horizontal-wordmark shorthand; keep honoring it.
  const resolvedSize: LogoSize = size ?? (compact ? "sm" : DEFAULT_SIZE[resolvedVariant]);
  const sizeClass = VARIANT_SIZE_CLASSES[resolvedVariant][resolvedSize];
  const trim = trimFor(resolvedVariant);
  const imgStyle = {
    "--brand-ink-scale": trim.inkRatio.toFixed(4),
    "--brand-ink-offset": trim.offsetRatio.toFixed(4),
  } as CSSProperties;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center gap-2 align-middle",
        product === "wallet" && "gap-2.5",
        className,
      )}
    >
      <img
        src={asset.src}
        alt={product === "wallet" ? "BTCBOX Wallet" : "BTCBOX"}
        width={asset.width}
        height={asset.height}
        className={cn("brand-logo-ink pointer-events-none w-auto object-contain", sizeClass)}
        style={imgStyle}
        decoding="async"
      />
      {product === "wallet" ? (
        <span className="flex min-w-0 flex-col justify-center leading-none">
          <span className="text-[15px] font-bold tracking-[0.14em] text-brand-text">BTCBOX</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-accent">Wallet</span>
        </span>
      ) : null}
    </span>
  );
}
