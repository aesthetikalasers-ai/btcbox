import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";

const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;
const BAR_TONE = ["bg-loss", "bg-loss", "bg-warning", "bg-brand-accent", "bg-positive"] as const;

export function passwordScore(value: string): number {
  if (value.length < 12) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(value)).length;
  let score = 1;
  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;
  if (classes >= 4 && value.length >= 16) score += 1;
  return Math.min(score, LABELS.length - 1);
}

export function PasswordStrength({ value }: { value: string }) {
  const { t } = useI18n();
  if (!value) return null;
  const score = passwordScore(value);
  return (
    <div className="space-y-1.5" role="status">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="flex shrink-0 gap-1">
          {BAR_TONE.map((tone, index) => (
            <span key={tone + index} className={cn("h-1.5 w-7 rounded-full transition-colors sm:w-9", index < score ? tone : "bg-brand-border")} />
          ))}
        </span>
        <span className="type-meta min-w-0 truncate font-semibold text-brand-text-secondary">
          {t("Password strength")}: {t(LABELS[score])}
        </span>
      </div>
      <p className="type-meta leading-5 text-brand-text-muted">{t("Use at least 12 characters with upper and lower case letters, numbers and symbols.")}</p>
    </div>
  );
}
