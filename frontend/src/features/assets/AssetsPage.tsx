import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { ApiError, getAccount, type AccountBalance, type AccountSnapshot } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

function amount(value: number | string | undefined) {
  if (typeof value === "string") {
    const normalized = value.trim();
    const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (!match) return "—";
    const [, sign, integer, fraction] = match;
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + grouped + (fraction ? "." + fraction : "");
  }
  if (value === undefined || value === null) return "—";
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "—";
}

export function AssetsPage() {
  const { t, language } = useI18n();
  const numberLocale = localeTags[language];
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const requestIdRef = useRef(0);

  async function load(signal?: AbortSignal) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setAccount(null);
    setError("");
    setSignedOut(false);
    try {
      const snapshot = await getAccount(signal);
      if (!signal?.aborted && requestId === requestIdRef.current) setAccount(snapshot);
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (signal?.aborted || requestId !== requestIdRef.current) return;
      setAccount(null);
      if (reason instanceof ApiError && reason.code === "AUTH_REQUIRED") {
        setSignedOut(true);
        setError(t("Sign in to view your assets."));
      } else {
        setError(reason instanceof Error ? reason.message : t("Account data is temporarily unavailable."));
      }
    } finally {
      if (!signal?.aborted && requestId === requestIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const balances = account?.balances ? Object.entries(account.balances) as Array<[string, AccountBalance]> : [];

  return (
    <div className="tone-assets mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-accent mb-1 text-xs font-bold uppercase tracking-[.18em]">{t("BTCBOX / WALLET")}</p>
          <h1 className="type-page-title text-brand-text">{t("Assets")}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("Refresh")}
        </Button>
      </div>

      {error && <Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="type-body-compact text-brand-text-secondary" role="alert">{error}</p>{signedOut && <Button asChild size="sm"><Link to="/login">{t("Sign in")}</Link></Button>}</CardContent></Card>}

      <div className="card-grid-equal gap-3 sm:gap-4">
        <Card className="flex min-w-0 flex-col border-brand-border bg-brand-surface ">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent"><Wallet className="h-5 w-5"/></span>
            <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Estimated total value")}</p><p className="mt-1 truncate text-lg font-semibold tracking-tight tabular-nums text-brand-text">{loading ? "—" : account?.valuation_complete ? formatDecimalAmount(account.totalUsdt, numberLocale) + " USDT" : "—"}</p><Badge className="mt-1" variant={account?.valuation_complete ? "outline" : "secondary"}>{loading ? t("Loading") : account?.valuation_complete ? t("Valuation complete") : t("Valuation incomplete")}</Badge></div>
          </CardContent>
        </Card>
        <Card className="flex min-w-0 flex-col border-brand-border bg-brand-surface ">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-cyan/10 text-brand-cyan"><Wallet className="h-5 w-5"/></span>
            <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Assets held")}</p><p className="mt-1 text-lg font-semibold tabular-nums text-brand-text">{loading || !account ? "—" : balances.length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-brand-border bg-brand-surface ">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-warning/10 text-brand-warning"><ShieldCheck className="h-5 w-5"/></span>
            <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Unpriced assets")}</p><p className="mt-1 text-lg font-semibold tabular-nums text-brand-text">{loading || !account ? "—" : account.unpriced_assets?.length ?? 0}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="type-section-title page-accent">{t("Asset balances")}</h2></div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary"><Link to="/deposit"><ArrowDownToLine className="mr-2 h-4 w-4"/>{t("Deposit")}</Link></Button>
          <Button asChild variant="outline"><Link to="/withdraw"><ArrowUpFromLine className="mr-2 h-4 w-4"/>{t("Withdraw")}</Link></Button>
        </div>
      </div>

      {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-live="polite"><div className="h-36 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-36 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-36 animate-pulse rounded-xl bg-brand-surface-2"/></div>
      : balances.length ? <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">{balances.map(([coin, balance]) => <div key={coin} className="balance-row">
        <div className="flex items-center gap-3"><TokenIcon symbol={coin} className="h-9 w-9 shrink-0" /><span className="font-semibold">{coin}</span><Link to={`/markets?q=${encodeURIComponent(coin)}`} className="ml-auto text-sm text-brand-accent">{t("Trade")}</Link></div>
        <div className="min-w-0 sm:text-right"><p className="text-xs text-brand-text-muted">{t("Available")}</p><p className="mt-1 break-all font-mono text-sm tabular-nums">{formatDecimalAmount(balance.free, numberLocale)}</p></div>
        <div className="min-w-0 text-right"><p className="text-xs text-brand-text-muted">{t("Frozen")}</p><p className="mt-1 break-all font-mono text-sm tabular-nums text-brand-text-secondary">{formatDecimalAmount(balance.frozen, numberLocale)}</p></div>
      </div>)}</div>
      : <Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-col items-center px-5 py-12 text-center"><Wallet className="mb-3 h-9 w-9 page-accent"/><p className="type-card-title text-brand-text">{t(signedOut ? "Sign in required" : error ? "Assets could not be loaded" : "No asset balances")}</p>{(signedOut || error) && <p className="type-body-compact mt-2 max-w-md text-brand-text-muted">{t(signedOut ? "Your private balances are available after you sign in." : "Refresh after the account service is available. No balance values have been fabricated.")}</p>}</CardContent></Card>}

      {account?.unpriced_assets?.length ? <p className="type-meta text-brand-text-muted">{t("Unpriced assets")}: {account.unpriced_assets.join(", ")}</p> : null}
    </div>
  );
}
