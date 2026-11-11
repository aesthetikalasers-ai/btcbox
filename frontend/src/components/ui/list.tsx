import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "./button";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";

export type SortDirection = "asc" | "desc" | null;

export function SortButton({
  label,
  direction,
  onClick,
  className,
}: {
  label: string;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ChevronsUpDown;
  const stateLabel = direction === "asc" ? t("ascending") : direction === "desc" ? t("descending") : t("unsorted");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${stateLabel}`}
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-control px-1.5 text-left type-table-head transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70",
        direction && "text-brand-accent",
        className,
      )}
    >
      {label}
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

export function LoadMore({
  shown,
  total,
  loading,
  label,
  loadingLabel,
  onClick,
}: {
  shown: number;
  total: number;
  loading: boolean;
  label: string;
  loadingLabel: string;
  onClick: () => void;
}) {
  if (shown >= total) return null;
  return (
    <div className="flex flex-col items-center gap-2 border-t border-brand-border-subtle p-4">
      <p className="type-meta text-brand-text-muted">{shown} / {total}</p>
      <Button type="button" size="sm" variant="outline" loading={loading} onClick={onClick}>{loading ? loadingLabel : label}</Button>
    </div>
  );
}
