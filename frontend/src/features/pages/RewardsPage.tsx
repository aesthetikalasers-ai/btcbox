import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Coins, Copy, Gift, Inbox, Share2, Users } from "lucide-react";
import { AuthRestoreState } from "../../components/AuthRestoreState";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { DEV_OPEN_ACCOUNT_PAGES } from "../../lib/devAccess";
import { useAuthDialog } from "../../lib/auth-dialog";
import { useI18n } from "../../lib/i18n";
import { getReferralData, referralShareUrl, type ReferralData } from "../../lib/referral";
import { PageFrame } from "./Pages";

/**
 * Referral rewards.
 *
 * Rendering rules, in order of precedence:
 *   1. Signed out            -> sign-in prompt (opens the shared auth dialog).
 *   2. Programme not enabled -> a plain "not open yet" notice with no figures.
 *   3. Enabled               -> only the values the backend actually returned.
 *
 * Nothing here exposes internal implementation detail to the visitor: no
 * endpoint names, no field names, no placeholder percentages and no invented
 * earnings. Missing values render as an em dash rather than a guess.
 */
export function RewardsPage() {
  const { t, language } = useI18n();
  const location = useLocation();
  const requestedBack = (location.state as { from?: string } | null)?.from;
  const backTo = requestedBack === "/home" || requestedBack === "/me" ? requestedBack : "/me";
  const { status } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(status === "authenticated");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [copied, setCopied] = useState<"code" | "link" | "">("");

  useEffect(() => {
    if (status !== "authenticated") {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getReferralData(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setData(null);
        setError(reason instanceof Error ? reason.message : "Reward information is temporarily unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, reload]);

  const copy = async (value: string | undefined, key: "code" | "link") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1800);
    } catch { /* clipboard unavailable: the value stays selectable */ }
  };

  const formatTime = (raw: string) => {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString(language);
  };
  const overview = data?.overview;
  const records = data?.records ?? [];
  const shareUrl = overview ? referralShareUrl(overview) : undefined;

  // Early returns keep each state flat: no deeply nested conditional JSX.
  if (status === "loading") {
    return <PageFrame title="Rewards & referrals" tone="account" backTo={backTo}><AuthRestoreState label="Loading reward information…" /></PageFrame>;
  }

  if (status !== "authenticated" && !DEV_OPEN_ACCOUNT_PAGES) {
    return <PageFrame title="Rewards & referrals" tone="account" backTo={backTo}>
      <Card className="border-brand-border bg-brand-surface">
        <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-accent/25 bg-brand-accent/10 text-brand-accent"><Gift className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-base font-bold text-brand-text">{t("Sign in to view your rewards")}</p>
              <p className="mt-0.5 text-xs leading-5 text-brand-text-muted">{t("Your invite code and reward records appear here once you sign in.")}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" className="min-w-[88px]" onClick={() => openAuthDialog("login")}>{t("Sign in")}</Button>
            <Button size="sm" variant="outline" className="min-w-[88px]" onClick={() => openAuthDialog("register")}>{t("Create account")}</Button>
          </div>
        </CardContent>
      </Card>
    </PageFrame>;
  }

  if (loading) {
    return <PageFrame title="Rewards & referrals" tone="account" backTo={backTo}>
      <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading reward information…")}</CardContent></Card>
    </PageFrame>;
  }

  if (error) {
    return <PageFrame title="Rewards & referrals" tone="account" backTo={backTo}>
      <Card className="border-brand-danger/30 bg-brand-surface">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-brand-danger" role="alert">{t(error)}</p>
          <Button size="sm" variant="outline" onClick={() => setReload((n) => n + 1)}>{t("Try again")}</Button>
        </CardContent>
      </Card>
    </PageFrame>;
  }

  if (!overview?.available) {
    return <PageFrame title="Rewards & referrals" tone="account" backTo={backTo}>
      <Card className="border-brand-border bg-brand-surface">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-text-muted"><Gift className="h-6 w-6" /></span>
          <p className="text-sm font-semibold text-brand-text">{t("Referral rewards are not open yet")}</p>
          <p className="max-w-md text-sm leading-6 text-brand-text-muted">{t("This section opens once referral rewards are available for your account. No earnings or invite counts are shown before then.")}</p>
          <Button asChild size="sm" variant="outline" className="mt-1"><Link to="/support">{t("Contact support")}</Link></Button>
        </CardContent>
      </Card>
    </PageFrame>;
  }

  return <PageFrame title="Rewards & referrals" tone="account" backTo={backTo}>
    <div className="flex min-w-0 flex-col gap-5">

      <section aria-label={t("Invite")} className="grid gap-3 sm:grid-cols-2">
        <Card className="border-brand-border bg-brand-surface">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("Your invite code")}</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between gap-3 pt-0">
            <span className="min-w-0 truncate font-mono text-lg font-bold tracking-wide text-brand-text">{overview?.code ?? "—"}</span>
            <Button size="sm" variant="outline" disabled={!overview?.code} onClick={() => void copy(overview?.code, "code")} className="shrink-0">
              {copied === "code" ? <><Check className="mr-1 h-3.5 w-3.5" />{t("Copied")}</> : <><Copy className="mr-1 h-3.5 w-3.5" />{t("Copy")}</>}
            </Button>
          </CardContent>
        </Card>
        <Card className="border-brand-border bg-brand-surface">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("Invite link")}</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between gap-3 pt-0">
            <span className="min-w-0 truncate text-xs text-brand-text-muted">{shareUrl ?? "—"}</span>
            <Button size="sm" variant="outline" disabled={!shareUrl} onClick={() => void copy(shareUrl, "link")} className="shrink-0">
              {copied === "link" ? <><Check className="mr-1 h-3.5 w-3.5" />{t("Copied")}</> : <><Share2 className="mr-1 h-3.5 w-3.5" />{t("Copy")}</>}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-label={t("Reward summary")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-4">
          <p className="text-xs font-medium text-brand-text-muted">{t("Total rewards")}</p>
          <p className="mt-2 break-all font-mono text-xl font-bold tabular-nums text-brand-text">{overview?.totalEarned ?? "—"} <span className="text-xs font-normal text-brand-text-muted">{overview?.asset ?? ""}</span></p>
        </CardContent></Card>
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-4">
          <p className="text-xs font-medium text-brand-text-muted">{t("Pending")}</p>
          <p className="mt-2 break-all font-mono text-xl font-bold tabular-nums text-brand-text">{overview?.pendingEarned ?? "—"} <span className="text-xs font-normal text-brand-text-muted">{overview?.asset ?? ""}</span></p>
        </CardContent></Card>
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-brand-text-muted"><Users className="h-3.5 w-3.5" />{t("Direct invites")}</p>
          <p className="mt-2 font-mono text-xl font-bold tabular-nums text-brand-text">{overview?.directCount ?? "—"}</p>
        </CardContent></Card>
        <Card className="border-brand-border bg-brand-surface"><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-brand-text-muted"><Users className="h-3.5 w-3.5" />{t("Second-level invites")}</p>
          <p className="mt-2 font-mono text-xl font-bold tabular-nums text-brand-text">{overview?.indirectCount ?? "—"}</p>
        </CardContent></Card>
      </section>

      <Card className="border-brand-border bg-brand-surface">
        <CardHeader><div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><Coins className="h-4 w-4" /></span>
          <div className="min-w-0"><CardTitle>{t("Reward records")}</CardTitle><CardDescription>{t("Every settled and pending reward from your invites.")}</CardDescription></div>
        </div></CardHeader>
        <CardContent className="pt-0">
          {records.length === 0 ? <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Inbox className="h-6 w-6 text-brand-text-muted" />
            <p className="text-sm text-brand-text-muted">{t("No reward records yet.")}</p>
          </div> : <div className="divide-y divide-brand-border-subtle">
            {records.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline">{t("Level")} {row.level}</Badge>
                <span className="min-w-0 truncate text-sm text-brand-text-muted">{formatTime(row.time)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Badge variant="outline" className={row.status === "settled" ? "border-brand-success/30 text-brand-success" : "border-brand-border text-brand-text-muted"}>{t(row.status === "settled" ? "Settled" : "Pending")}</Badge>
                <span className="font-mono text-sm font-semibold tabular-nums text-brand-text">+{row.amount} {row.asset}</span>
              </div>
            </div>)}
          </div>}
        </CardContent>
      </Card>
    </div>
  </PageFrame>;
}
