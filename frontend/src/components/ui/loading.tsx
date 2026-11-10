import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function Skeleton({ className, style, ...rest }: React.ComponentProps<"div">) {
  return <div aria-hidden="true" style={style} className={cn("animate-pulse rounded-control bg-brand-surface-2", className)} {...rest} />;
}

/** Canonical table loading: header bar plus N row placeholders. */
export function TableSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("space-y-2 p-4", className)}>
      <Skeleton className="h-3.5 w-1/3" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Canonical chart loading block: fixed aspect so layout never jumps. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("flex min-h-[9rem] items-end gap-1.5 p-4", className)}>
      {[42, 68, 55, 80, 62, 90, 74, 58, 84, 66].map((height, index) => (
        <Skeleton key={index} className="flex-1" style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}

/** Canonical inline waiting state: spinner plus label, replaces ad-hoc "Loading…" text. */
export function LoadingBlock({ label, className }: { label: string; className?: string }) {
  return (
    <p role="status" aria-busy="true" className={cn("flex items-center justify-center gap-2 py-6 text-sm text-brand-text-muted", className)}>
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}
    </p>
  );
}
