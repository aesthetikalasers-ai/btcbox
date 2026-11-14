import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, LockKeyhole, RefreshCw, Wallet } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { ApiError, getAccount, type AccountBalance, type AccountSnapshot } from "../../lib/api";
import { formatDecimalAmount, localeTags, useI18n } from "../../lib/i18n";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { DEMO_PREVIEW_ACTIVE } from "../../lib/demoPreview";
import { useAuth } from "../../lib/auth";
import { useTrading } from "../../lib/trading";

const PINNED_COINS = ["BTC", "ETH", "USDT"];

/**
 * Displays the user's asset balances and wallet actions.
 * Refreshes account data through the existing account API without changing balances.
 */
export function AssetsPage() {
  const { t, language } = useI18n();
  const { status } = useAuth();
  const authenticated = status === "authenticated";
  const { balances: paperBalances } = useTrading();
  const numberLocale = localeTags[language];
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
    setAccount(null);
    setError("");
    setSignedOut(false);
    try {
      const snapshot = await getAccount(controller.signal);
      if (!controller.signal.aborted && requestId === requestIdRef.current) setAccount(snapshot);
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setAccount(null);
      if (reason instanceof ApiError && reason.code === "AUTH_REQUIRED") {
        setSignedOut(true);
        setError("Sign in to view your assets.");
      } else {
        setError(reason instanceof Error ? reason.message : "Account data is temporarily unavailable.");
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

  const balances = useMemo(() => {
    // 合并后端账户余额与纸面交易账本（演示持仓）
    const merged: Record<string, AccountBalance> = { ...(account?.balances ?? {}) };
    for (const [coin, b] of Object.entries(paperBalances)) {
      merged[coin] = {
        free: b.free,
        frozen: b.frozen,
        valuation_available: false,
      };
    }
    const entries = Object.entries(merged) as Array<[string, AccountBalance]>;
    const pinned = PINNED_COINS.map((coin) => entries.find(([c]) => c.toUpperCase() === coin)).filter((x): x is [string, AccountBalance] => Boolean(x));
    const rest = entries
      .filter(([coin]) => !PINNED_COINS.includes(coin.toUpperCase()))
      .sort((a, b) => Number(b[1].free || 0) + Number(b[1].frozen || 0) - (Number(a[1].free || 0) + Number(a[1].frozen || 0)));
    return [...pinned, ...rest];
  }, [account, paperBalances]);

  return (
    <div aria-busy={loading} className="tone-assets mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="type-page-title text-brand-text">{t("Assets")}</h1>
          {account && !loading && <p className="mt-1.5 text-sm text-brand-text-muted">{t(DEMO_PREVIEW_ACTIVE ? "Demo preview" : "Live account data")}</p>}
        </div>
        <Button variant="outline" size="sm" className="min-h-11" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("Refresh")}
        </Button>
      </div>
      {!authenticated ? (
        <Card className="border-brand-border bg-brand-surface">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
              <LockKeyhole className="h-8 w-8" />
            </span>
            <h2 className="text-xl font-semibold text-brand-text">{t("Sign in to view your assets.")}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-brand-text-muted">{t("Create an account or sign in to manage your personal assets and account services.")}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="min-h-12 px-6 text-sm font-bold"><Link to="/login">{t("Sign in")}</Link></Button>
              <Button asChild variant="secondary" className="min-h-12 px-6 text-sm font-bold"><Link to="/register">{t("Create account")}</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
      {error && <Card className="border-brand-danger/25 bg-brand-danger/[0.045]"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="type-body-compact text-brand-danger" role="alert">{t(error)}</p>{signedOut && <Button asChild size="sm"><Link to="/login">{t("Sign in")}</Link></Button>}</CardContent></Card>}
      <Card className="relative isolate overflow-hidden border-brand-accent/25 bg-[radial-gradient(ellipse_at_95%_0%,rgba(33,199,168,.14),transparent_44%),linear-gradient(135deg,#14212b_0%,#111b24_100%)] shadow-[0_18px_50px_-32px_rgba(0,0,0,.8)]">
        <CardContent className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 -z-10 flex h-40 w-40 items-center justify-center rounded-full border border-brand-accent/10 bg-brand-accent/[.035] text-brand-accent/[.07] sm:right-32 sm:h-52 sm:w-52">
            <Wallet className="h-28 w-28 sm:h-36 sm:w-36" strokeWidth={0.75} />
          </div>
          <div className="relative min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-accent/20 bg-brand-accent/10 text-brand-accent"><Wallet className="h-4 w-4" /></span>
              <p className="type-label text-brand-text-muted">{t("Estimated total value")}</p>
            </div>
            <p className="mt-3 break-all font-mono text-[28px] font-semibold leading-tight tracking-tight tabular-nums text-brand-text sm:text-[34px]">{loading ? "—" : account?.valuation_complete ? formatDecimalAmount(account.totalUsdt, numberLocale) + " USDT" : "—"}</p>
            {!loading && account && !account.valuation_complete && <p className="mt-2 max-w-xl text-xs leading-5 text-brand-text-muted">{t("Some asset prices are unavailable; total valuation is incomplete.")}</p>}
          </div>
          <div className="relative grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[280px]">
            {DEMO_PREVIEW_ACTIVE
              ? <><Button type="button" className="min-h-12 text-sm font-bold sm:text-base" disabled><ArrowDownToLine className="h-4 w-4"/>{t("Deposit")}</Button><Button type="button" className="min-h-12 text-sm font-bold sm:text-base" variant="outline" disabled><ArrowUpFromLine className="h-4 w-4"/>{t("Withdraw")}</Button></>
              : <><Button asChild className="min-h-12 text-sm font-bold sm:text-base"><Link to="/deposit"><ArrowDownToLine className="h-4 w-4"/>{t("Deposit")}</Link></Button><Button asChild variant="outline" className="min-h-12 text-sm font-bold sm:text-base"><Link to="/withdraw"><ArrowUpFromLine className="h-4 w-4"/>{t("Withdraw")}</Link></Button></>}
          </div>
        </CardContent>
      </Card>
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="type-section-title page-accent">{t("Asset balances")}</h2><p className="mt-1 text-xs text-brand-text-muted">{t("Available")} · {t("Frozen")} · {t("USDT value")}</p></div>
      </div>
      {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-live="polite"><div className="h-40 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-40 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-40 animate-pulse rounded-xl bg-brand-surface-2"/></div>
      : balances.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{balances.map(([coin, balance]) => <Card key={coin} className="card-lift relative overflow-hidden bf-card-deep">
        <span aria-hidden="true" className="absolute inset-y-4 left-0 w-0.5 rounded-r-full bg-brand-accent/70" />
        <CardContent className="p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <TokenIcon symbol={coin} className="h-10 w-10 shrink-0" />
            <div className="min-w-0"><p className="truncate font-semibold text-brand-text">{coin}</p><p className="type-meta mt-0.5 text-brand-text-muted">{t("Wallet balance")}</p></div>
            <Link to={`/markets?q=${encodeURIComponent(coin)}`} className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-accent transition-colors hover:bg-brand-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">{t("Trade")}<ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-brand-border-subtle pt-4">
            <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Available")}</p><p className="mt-1 break-all font-mono text-sm font-semibold tabular-nums text-brand-text">{formatDecimalAmount(balance.free, numberLocale)}</p></div>
            <div className="min-w-0 text-right"><p className="type-meta text-brand-text-muted">{t("Frozen")}</p><p className="mt-1 break-all font-mono text-sm tabular-nums text-brand-text-secondary">{formatDecimalAmount(balance.frozen, numberLocale)}</p></div>
            <div className="col-span-2 flex min-w-0 items-baseline justify-between gap-3 border-t border-brand-border-subtle pt-3"><p className="type-meta text-brand-text-muted">{t("USDT value")}</p><p className="break-all text-right font-mono text-sm font-medium tabular-nums text-brand-text">{balance.valuation_available === true && balance.usdt !== undefined ? formatDecimalAmount(balance.usdt, numberLocale) : "—"}</p></div>
          </div>
        </CardContent>
      </Card>)}</div>
      : <Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-col items-center px-5 py-12 text-center"><Wallet className="mb-3 h-9 w-9 page-accent"/><p className="type-card-title text-brand-text">{t(signedOut ? "Sign in required" : error ? "Assets could not be loaded" : "No asset balances")}</p>{(signedOut || error) && <p className="type-body-compact mt-2 max-w-md text-brand-text-muted">{t(signedOut ? "Your private balances are available after you sign in." : "Refresh after the account service is available. No balance values have been fabricated.")}</p>}{!signedOut && !error && <Button asChild className="mt-4"><Link to="/deposit">{t("Deposit")}</Link></Button>}</CardContent></Card>}
        </>
      )}
    </div>
  );
}
