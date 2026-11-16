import { useEffect, useRef, useState } from "react";
import { ChevronDown, HelpCircle, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { getSupportFaq, type SupportFaqEntry } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";

// Help copy is owned by the backend (`support_faq` in the persisted state document)
// so operations can add, edit, reorder, disable or delete articles from the
// administrator console without shipping a new frontend build. Nothing is
// hard-coded here: when the catalogue is empty or unreachable the component says
// so instead of showing stale bundled answers.
//
// The six identifiers below are the articles BTCBOX ships by default. Their copy
// lives in the translation dictionary, so passing them through `t()` keeps the
// help centre localised. Staff-authored articles are rendered verbatim, which is
// why they are not passed through `t()` (that would only emit missing-key noise).
const DEFAULT_FAQ_IDS = new Set([
  "faq-account-verification",
  "faq-deposit-withdrawal-time",
  "faq-products",
  "faq-account-security",
  "faq-order-failures",
  "faq-support-replies",
]);

export function SupportFaq() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<SupportFaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string[]>([]);
  const [reload, setReload] = useState(0);
  const autoOpened = useRef(false);
  const toggle = (id: string) => setOpen((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    getSupportFaq(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setEntries(items);
        // Expand the first article once, matching the previous static list.
        if (!autoOpened.current && items.length > 0) {
          autoOpened.current = true;
          setOpen([items[0].id]);
        }
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (!controller.signal.aborted) { setEntries([]); setFailed(true); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  const label = (entry: SupportFaqEntry, value: string) => DEFAULT_FAQ_IDS.has(entry.id) ? t(value) : value;

  return (
    <Card className="overflow-hidden border-brand-border bg-brand-surface p-0">
      <CardHeader className="border-b border-brand-border-subtle p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><HelpCircle className="h-4 w-4" /></span>
          <div className="min-w-0">
            <CardTitle>{t("Frequently asked questions")}</CardTitle>
            <CardDescription>{t("Answers follow your selected language.")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-brand-border-subtle p-0">
        {loading ? <p className="p-4 text-sm text-brand-text-muted sm:p-5" role="status">{t("Loading help articles…")}</p>
        : failed ? <div className="p-4 sm:p-5"><p className="text-sm text-brand-text-muted" role="alert">{t("Help articles could not be loaded.")}</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setReload((n) => n + 1)}><RefreshCw className="mr-2 h-4 w-4" />{t("Try again")}</Button></div>
        : entries.length === 0 ? <p className="p-4 text-sm text-brand-text-muted sm:p-5">{t("Help articles are being prepared. You can still send a message to support.")}</p>
        : entries.map((entry, index) => {
          const expanded = open.includes(entry.id);
          const panelId = `support-faq-panel-${index}`;
          const triggerId = `support-faq-trigger-${index}`;
          return (
            <div key={entry.id}>
              <h3 className="m-0">
                <button
                  id={triggerId}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggle(entry.id)}
                  className="flex min-h-12 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/70 sm:px-5"
                >
                  <span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{label(entry, entry.question)}</span>
                  <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-brand-text-muted transition-transform", expanded && "rotate-180")} />
                </button>
              </h3>
              {expanded && (
                <div id={panelId} role="region" aria-labelledby={triggerId} className="anim-fade-in px-4 pb-4 sm:px-5">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-brand-text-secondary">{label(entry, entry.answer)}</p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
