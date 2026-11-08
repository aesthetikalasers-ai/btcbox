import { cn } from "../../lib/utils";
import { useState } from "react";

export const TokenIcon = ({ symbol, className }: { symbol: string, className?: string }) => {
  const iconUrl = `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
  const [hasError, setHasError] = useState(false);

  return (
    <div className={cn("relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border-subtle bg-brand-surface-2", className)}>
      {hasError ? (
        <span className="text-[10px] font-bold text-brand-text-secondary leading-none">
          {symbol.substring(0, 3)}
        </span>
      ) : (
        <img
          src={iconUrl}
          alt={symbol}
          className="block h-full w-full object-contain"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
};
