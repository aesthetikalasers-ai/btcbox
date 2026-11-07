import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Wallet } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { ApiError, getAccount, type AccountBalance, type AccountSnapshot } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

function amount(value: number | string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { maximumFractionDigits: 8 }) : "—";
}

export function AssetsPage() {
  const { t } = useI18n();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  async function load() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    setSignedOut(false);
    setAccount(null);
    try {
      const snapshot = await getAccount(controller.signal);
      if (!controller.signal.aborted && requestId === requestIdRef.current) setAccount(snapshot);
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setAccount(null);
      if (reason instanceof ApiError && reason.code === "AUTH_REQUIRED") {
        setSignedOut(true);
        setError(t("Sign in to view your assets."));
      } else {
        setError(reason instanceof Error ? reason.message : t("Account data is temporarily unavailable."));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        controllerRef.current = null;
      }
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
    <div className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-secondary">{t("BTCBOX / WALLET")}</p>
          <h1 className="type-page-title text-brand-text">{t("Assets")}</h1>
          <p className="type-body mt-2 text-brand-text-secondary">{t("Balances from your authenticated BTCBOX account.")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("Refresh")}
        </Button>
      </div>

      {error && <Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="type-body-compact text-brand-text-secondary" role="alert">{error}</p>{signedOut && <Button asChild size="sm"><Link to="/login">{t("Sign in")}</Link></Button>}</CardContent></Card>}

      <Card className="border-brand-border bg-brand-surface">
        <CardHeader>
          <CardDescription>{t("Estimated total value")}</CardDescription>
          <CardTitle className="type-display tabular-nums">{loading ? "—" : account?.valuation_complete ? `${amount(account.totalUsdt)} USDT` : "—"}</CardTitle>
          {account && <div className="flex flex-wrap items-center gap-2 pt-1"><Badge variant={account.valuation_complete ? "outline" : "secondary"}>{t(account.valuation_complete ? "Valuation complete" : "Partial valuation")}</Badge>{!account.valuation_complete && <span className="type-meta text-brand-text-muted">{t("Some assets do not have a verified USDT valuation.")}</span>}</div>}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="secondary"><Link to="/deposit"><ArrowDownToLine className="mr-2 h-4 w-4"/>{t("Deposit")}</Link></Button>
          <Button asChild variant="outline"><Link to="/withdraw"><ArrowUpFromLine className="mr-2 h-4 w-4"/>{t("Withdraw")}</Link></Button>
        </CardContent>
      </Card>

      <Card className="border-brand-border bg-brand-surface">
        <CardHeader><CardTitle>{t("Asset balances")}</CardTitle><CardDescription>{t("Available and frozen amounts returned by the account service.")}</CardDescription></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="space-y-3 p-5" role="status" aria-live="polite"><div className="h-4 w-1/3 animate-pulse rounded bg-brand-surface-2"/><div className="h-12 animate-pulse rounded bg-brand-surface-2"/><div className="h-12 animate-pulse rounded bg-brand-surface-2"/></div>
          : balances.length ? <div className="divide-y divide-brand-border">{balances.map(([coin, balance])=><div key={coin} className="grid grid-cols-3 gap-3 px-4 py-4 sm:px-5"><div className="min-w-0"><p className="font-semibold text-brand-text">{coin}</p><p className="type-meta text-brand-text-muted">{t("Asset")}</p></div><div className="min-w-0 text-right"><p className="font-mono tabular-nums text-brand-text">{amount(balance.free)}</p><p className="type-meta text-brand-text-muted">{t("Available")}</p></div><div className="min-w-0 text-right"><p className="font-mono tabular-nums text-brand-text-secondary">{amount(balance.frozen)}</p><p className="type-meta text-brand-text-muted">{t("Frozen")}</p></div></div>)}</div>
          : <div className="flex flex-col items-center px-5 py-12 text-center"><Wallet className="mb-3 h-9 w-9 text-brand-text-muted"/><p className="type-card-title text-brand-text">{t(signedOut ? "Sign in required" : error ? "Assets could not be loaded" : "No asset balances")}</p><p className="type-body-compact mt-2 max-w-md text-brand-text-muted">{t(signedOut ? "Your private balances are available after you sign in." : error ? "Refresh after the account service is available. No balance values have been fabricated." : "No balance rows were returned for this account.")}</p></div>}
        </CardContent>
      </Card>

      {account?.unpriced_assets?.length ? <p className="type-meta text-brand-text-muted">{t("Unpriced assets")}: {account.unpriced_assets.join(", ")}</p> : null}
    </div>
  );
}
