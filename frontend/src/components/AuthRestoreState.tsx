import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button } from "./ui/button";

export function AuthRestoreState({ label = "Loading secure sign-in…" }: { label?: string }) {
  const { initializationIssue } = useAuth();
  const { t } = useI18n();
  return <section className="mx-auto flex min-h-[240px] max-w-xl flex-col items-center justify-center gap-4 p-6 text-center" role="status" aria-live="polite">
    {!initializationIssue && <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-border border-t-brand-accent" aria-hidden="true" />}
    <p className="text-sm text-brand-text-secondary">{t(initializationIssue ? "Account verification is taking longer than expected. Your session has not been cleared." : label)}</p>
    {initializationIssue && <div className="flex flex-wrap justify-center gap-2"><Button onClick={() => window.location.reload()}>{t("Try again")}</Button><Button asChild variant="outline"><Link to="/home">{t("View markets")}</Link></Button></div>}
  </section>;
}
