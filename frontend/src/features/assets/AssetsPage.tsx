import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, ArrowLeftRight, ChevronDown, Eye, EyeOff, LockKeyhole, Sprout, Wallet } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { ApiError, getAccount, type AccountBalance, type AccountSnapshot } from "../../lib/api";
import { formatDecimalAmount, localeTags, useI18n } from "../../lib/i18n";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { useAuth } from "../../lib/auth";
import { DEV_OPEN_ACCOUNT_PAGES } from "../../lib/devAccess";

const PINNED_COINS = ["BTC", "ETH", "USDT"];

/** Display names shown under each asset symbol (Binance-style asset list). */
const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  USDT: "TetherUS",
  USDC: "USD Coin",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  AVAX: "Avalanche",
  SUI: "Sui",
  LINK: "Chainlink",
  DOT: "Polkadot",
  LTC: "Litecoin",
  TRX: "TRON",
  BCH: "Bitcoin Cash",
  ATOM: "Cosmos",
  ETC: "Ethereum Classic",
  PEPE: "Pepe",
};

/**
 * Displays the user's asset balances and wallet actions.
 * Refreshes account data through the existing account API without changing balances.
 */
export function AssetsPage() {
  const { t, language } = useI18n();
  const { status } = useAuth();
  const authenticated = status === "authenticated";
  const numberLocale = localeTags[language];
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  // 隐私模式：隐藏总资产数字（币安 App 同款眼睛切换）。
  const [balanceVisible, setBalanceVisible] = useState(true);
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
    const entries = Object.entries(account?.balances ?? {}) as Array<[string, AccountBalance]>;
    const pinned = PINNED_COINS.map((coin) => entries.find(([c]) => c.toUpperCase() === coin)).filter((x): x is [string, AccountBalance] => Boolean(x));
    const rest = entries
      .filter(([coin]) => !PINNED_COINS.includes(coin.toUpperCase()))
      .sort((a, b) => Number(b[1].free || 0) + Number(b[1].frozen || 0) - (Number(a[1].free || 0) + Number(a[1].frozen || 0)));
    return [...pinned, ...rest];
  }, [account]);

  return (
    <div aria-busy={loading} className="tone-assets relative mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8">
      {/* Ambient multi-layer glow + glass highlight, matching Dashboard / Markets / Trade. */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-8 right-10 h-36 w-36 rounded-full bg-brand-accent/20 blur-[45px]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-page-title text-brand-text">{t("Assets")}</h1>
      </div>
      {/* Signed-out visitors get a sign-in card in production builds. In local
          development the layout is rendered directly so the page can be worked
          on without a session (every account API still answers AUTH_REQUIRED). */}
      {!authenticated && !DEV_OPEN_ACCOUNT_PAGES ? (
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
      {/* The auth error is a rendering artifact in dev-open mode: the wall is
          gone, so surfacing "Sign in to view your assets." as a red alert would
          be misleading. Real service errors still show. */}
      {error && (authenticated || !DEV_OPEN_ACCOUNT_PAGES) && <Card className="border-brand-danger/25 bg-brand-danger/[0.045]"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="type-body-compact text-brand-danger" role="alert">{t(error)}</p>{signedOut && <Button asChild size="sm"><Link to="/login">{t("Sign in")}</Link></Button>}</CardContent></Card>}
      <Card className="relative isolate overflow-hidden border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-md">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-brand-accent/60 to-transparent" />
        <CardContent className="relative flex flex-col gap-4 p-5 sm:p-6">
          {/* 行 1：总资产估值 + 隐私眼睛 */}
          <div className="relative flex items-center gap-2">
            <p className="text-sm text-brand-text-secondary">{t("Estimated total value")}</p>
            <button type="button" onClick={() => setBalanceVisible((v) => !v)} aria-label={t("Toggle balance visibility")}
              className="flex h-6 w-6 items-center justify-center rounded text-brand-text-muted transition-colors hover:text-brand-text">
              {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          {/* 行 2：大数字 + USDT ▾ */}
          <div className="relative flex items-baseline gap-2">
            <p className="break-all font-mono text-[30px] font-bold leading-tight tracking-tight tabular-nums text-brand-text sm:text-[36px]">
              {loading ? "—" : !balanceVisible ? "****" : account?.valuation_complete ? formatDecimalAmount(account.totalUsdt, numberLocale) : "—"}
            </p>
            <span className="flex items-center text-sm font-semibold text-brand-text-muted">USDT <ChevronDown className="ml-0.5 inline h-3.5 w-3.5" /></span>
          </div>
          {/* 行 3：≈ $ 小字 */}
          <p className="relative text-xs text-brand-text-muted">
            {loading ? "" : !balanceVisible ? "" : account?.valuation_complete ? `≈ $${formatDecimalAmount(account.totalUsdt, numberLocale)}` : ""}
          </p>
          {/* 行 4：今日盈亏（无盈亏数据时隐藏） */}
          {!loading && balanceVisible && (
            <div className="relative flex items-center gap-2 text-sm">
              <span className="text-brand-text-secondary">{t("Today's PnL")}</span>
              <span className="font-mono font-semibold tabular-nums text-brand-text-muted">— USDT (—%)</span>
            </div>
          )}
          {/* Keep deposit and withdrawal as independent first-level asset actions. */}
          <div className="relative grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[340px]">
            <Button asChild className="min-h-11 text-sm font-bold"><Link to="/deposit"><ArrowDownToLine className="h-4 w-4"/>{t("Deposit")}</Link></Button>
            <Button asChild variant="outline" className="min-h-11 text-sm font-bold"><Link to="/withdraw"><ArrowUpFromLine className="h-4 w-4"/>{t("Withdraw")}</Link></Button>
          </div>
          <div className="relative flex flex-wrap gap-2">
            <Button asChild variant="ghost" className="min-h-10 text-sm"><Link to="/convert"><ArrowLeftRight className="h-4 w-4"/>{t("Convert")}</Link></Button>
            <Button asChild variant="ghost" className="min-h-10 text-sm"><Link to="/earn"><Sprout className="h-4 w-4"/>{t("Earn")}</Link></Button>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-end justify-between gap-3">
        <h2 className="type-section-title page-accent">{t("Asset balances")}</h2>
      </div>
      {loading ? <div className="space-y-2" role="status" aria-live="polite"><div className="h-14 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-14 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-14 animate-pulse rounded-xl bg-brand-surface-2"/></div>
      : balances.length ? <div data-testid="asset-balance-list" className="overflow-hidden pb-[calc(120px+env(safe-area-inset-bottom))] md:pb-4">
        <div className="divide-y divide-white/[0.06]">
          {balances.map(([coin, balance]) => {
            const coinName = COIN_NAMES[coin] ?? coin;
            return (
              <div key={coin} className="px-4 py-3.5 transition-colors hover:bg-white/[0.02]">
                <div className="flex items-start gap-3">
                  <TokenIcon symbol={coin} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-text">{coin}</p>
                    <p className="mt-0.5 truncate text-[11px] text-brand-text-muted">{t(coinName)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-bold tabular-nums text-brand-text">{formatDecimalAmount(balance.free, numberLocale)}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-brand-text-muted">{t("In orders")}: {formatDecimalAmount(balance.frozen, numberLocale)}</p>
                    {balance.valuation_available === true && balance.usdt !== undefined ? <p className="mt-0.5 text-[11px] tabular-nums text-brand-text-muted">{formatDecimalAmount(balance.usdt, numberLocale)} USDT</p> : null}
                  </div>
                </div>
                <div className="mt-2.5 flex justify-end gap-2">
                  <Link to="/earn" className="inline-flex items-center rounded-md bg-brand-surface-2 px-3 py-1.5 text-xs font-semibold text-brand-text-secondary transition-colors hover:bg-brand-surface-hover">
                    {t("Earn")}
                  </Link>
                  <Link to={`/trade/${coin}USDT`} className="inline-flex items-center rounded-md bg-brand-surface-2 px-3 py-1.5 text-xs font-semibold text-brand-text-secondary transition-colors hover:bg-brand-surface-hover">
                    {t("Trade")}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      : (authenticated && (signedOut || error)) ? <Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-col items-center px-5 py-12 text-center"><Wallet className="mb-3 h-9 w-9 page-accent"/><p className="type-card-title text-brand-text">{t(signedOut ? "Sign in required" : "Assets could not be loaded")}</p><p className="type-body-compact mt-2 max-w-md text-brand-text-muted">{t(signedOut ? "Your private balances are available after you sign in." : "Refresh after the account service is available. No balance values have been fabricated.")}</p></CardContent></Card>
      : <Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-col items-center px-5 py-12 text-center"><Wallet className="mb-3 h-9 w-9 page-accent"/><p className="type-body-compact text-brand-text-muted">{t("No asset balances are currently available.")}</p></CardContent></Card>}
        </>
      )}
    </div>
  );
}
