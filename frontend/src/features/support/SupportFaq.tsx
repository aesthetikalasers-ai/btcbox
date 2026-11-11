import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";

// Help copy is part of the dictionary, so the FAQ follows the visitor's language
// without a separate content store. Human replies stay in the agent's language.
const ENTRIES: Array<{ question: string; answer: string }> = [
  {
    question: "How do I create and verify my BTCBOX account?",
    answer: "Register with a username, set a login password, then open Identity verification from your account page and submit the requested documents. Verified accounts can deposit, withdraw and place larger orders.",
  },
  {
    question: "How long do deposits and withdrawals take?",
    answer: "Deposits are credited after the network confirmations required for that asset. Withdrawal requests are reviewed by the BTCBOX team and broadcast after approval. The current status of each request is listed under Withdrawals in Assets.",
  },
  {
    question: "Which products does BTCBOX offer?",
    answer: "Four products: Spot for listed pairs against USDT, Seconds for short-duration directional rounds, Contract for perpetual markets with funding and positions, and Earn for flexible and fixed-term yield on idle balances.",
  },
  {
    question: "How do I keep my account secure?",
    answer: "Enable two-factor authentication under Account security, use a password that is unique to BTCBOX and never share verification codes. BTCBOX staff will never ask for your password, two-factor codes or wallet recovery phrase.",
  },
  {
    question: "What should I do when a market or an order fails?",
    answer: "Check the feed status on the Markets page first: stale snapshots hide quotes until fresh data arrives. Rejected orders show the reason returned by the trading service. If the problem persists, send the symbol, time and error text to support from this page.",
  },
  {
    question: "How are support replies handled?",
    answer: "Messages sent here are stored in your private account conversation and answered by the support team in the order they are received. Replies appear in this conversation and in the notification bell. We do not use automated answers, so every message is read by a person.",
  },
];

export function SupportFaq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number[]>([]);
  const toggle = (index: number) => setOpen((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);

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
        {ENTRIES.map(({ question, answer }, index) => {
          const expanded = open.includes(index);
          const panelId = `support-faq-panel-${index}`;
          const triggerId = `support-faq-trigger-${index}`;
          return (
            <div key={question}>
              <h3 className="m-0">
                <button
                  id={triggerId}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggle(index)}
                  className="flex min-h-12 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/70 sm:px-5"
                >
                  <span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t(question)}</span>
                  <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-brand-text-muted transition-transform", expanded && "rotate-180")} />
                </button>
              </h3>
              {expanded && (
                <div id={panelId} role="region" aria-labelledby={triggerId} className="anim-fade-in px-4 pb-4 sm:px-5">
                  <p className="text-sm leading-6 text-brand-text-secondary">{t(answer)}</p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
