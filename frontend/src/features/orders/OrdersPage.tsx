import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ClipboardList, RefreshCw } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { EmptyState } from "../../components/ui/empty-state";
import { PageHeader } from "../../components/ui/page-header";
import { ApiError, getOrders, type OrderRecord } from "../../lib/api";
import { useI18n, type Language } from "../../lib/i18n";

const dateLocales: Record<Language, string> = { en: "en-US", ja: "ja-JP", "zh-CN": "zh-CN", es: "es-ES", pt: "pt-PT", it: "it-IT", de: "de-DE" };

function formatDate(value: unknown, locale: string) {
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function display(value: unknown, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function statusVariant(status: string) {
  const value = status.toLowerCase();
  if (["filled", "completed", "success", "closed"].includes(value)) return "success" as const;
  if (["cancelled", "canceled", "rejected", "failed"].includes(value)) return "destructive" as const;
  if (["pending", "open", "partially_filled", "partially-filled", "processing", "review"].includes(value)) return "warning" as const;
  return "outline" as const;
}

export function OrdersPage() {
  const { t, language } = useI18n();
  const dateLocale = dateLocales[language];
  const [openOnly, setOpenOnly] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
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
    setOrders([]);
    setError("");
    setSignedOut(false);
    try {
      const rows = await getOrders(controller.signal);
      if (!controller.signal.aborted && requestId === requestIdRef.current) setOrders(rows);
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setOrders([]);
      if (reason instanceof ApiError && reason.code === "AUTH_REQUIRED") {
        setSignedOut(true);
        setError("Sign in to view your order history.");
      } else {
        setError(reason instanceof Error ? reason.message : "Order history is temporarily unavailable.");
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

  const visibleOrders = openOnly ? orders.filter(order => ["open", "partially_filled", "partially-filled", "pending"].includes(String(order.status || "").toLowerCase())) : orders;

  return (
    <div aria-busy={loading} className="tone-orders mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8">
      <PageHeader
        eyebrow={t("BTCBOX / ACCOUNT")}
        title={t("Orders")}
        actions={<Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("Refresh")}
        </Button>}
      />

      {error && (
        <Alert
          tone="danger"
          action={signedOut
            ? <Button asChild size="sm"><Link to="/login">{t("Sign in")} <ArrowUpRight className="h-4 w-4" /></Link></Button>
            : <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>{t("Try again")}</Button>}
        >{t(error)}</Alert>
      )}

      <Card className="overflow-hidden border-brand-border bg-brand-surface ">
        <CardHeader className="border-b border-brand-border bg-brand-surface-2/50 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--page-accent)]/10 text-[var(--page-accent)]"><ClipboardList className="h-5 w-5"/></span><CardTitle className="min-w-0">{t("Order history")}</CardTitle></div><div className="mt-3 flex flex-wrap gap-2 sm:mt-0"><Button variant={openOnly ? "default" : "outline"} size="sm" aria-pressed={openOnly} onClick={() => setOpenOnly(true)}>{t("Open orders")}</Button><Button variant={!openOnly ? "default" : "outline"} size="sm" aria-pressed={!openOnly} onClick={() => setOpenOnly(false)}>{t("Order history")}</Button></div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5" role="status" aria-live="polite">
              <div className="h-4 w-1/3 animate-pulse rounded bg-brand-surface-2" />
              <div className="h-12 animate-pulse rounded bg-brand-surface-2" />
              <div className="h-12 animate-pulse rounded bg-brand-surface-2" />
            </div>
          ) : visibleOrders.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t(openOnly ? "No open orders" : "No orders yet")}
              hint={t(openOnly ? "You have no working orders. Switch to order history to review completed orders." : "When you place an order, its status and details will appear here.")}
              action={<Button asChild variant="secondary" size="sm"><Link to="/trade-hub">{t("Explore trading")} <ArrowUpRight className="h-4 w-4" /></Link></Button>}
            />
          ) : (
            <>
              <div className="grid gap-3 p-3 md:hidden">
                {visibleOrders.map((order, index) => {
                  const id = display(order.order_id ?? order.id, `#${index + 1}`);
                  const side = display(order.side);
                  return <Card key={id} className="border-brand-border bg-brand-surface-2/50  transition-all hover:border-brand-accent/30 hover:bg-brand-surface-2/80">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0"><p className="font-semibold text-brand-text">{display(order.symbol)}</p><p className="mt-1 truncate font-mono text-[11px] text-brand-text-muted">{id}</p></div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2"><Badge variant={side.toLowerCase() === "buy" ? "default" : "outline"}>{t(side)}</Badge><Badge className="whitespace-nowrap" variant={statusVariant(display(order.status, "unknown"))}>{t(display(order.status, "Unknown"))}</Badge></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-brand-surface p-3"><p className="type-meta text-brand-text-muted">{t("Price")}</p><p className="mt-1 break-all font-mono text-sm tabular-nums text-brand-text">{display(order.price)}</p></div>
                        <div className="rounded-lg bg-brand-surface p-3"><p className="type-meta text-brand-text-muted">{t("Quantity")}</p><p className="mt-1 break-all font-mono text-sm tabular-nums text-brand-text">{display(order.quantity ?? order.amount)}</p></div>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-brand-border pt-2 text-xs"><span className="text-brand-text-muted">{t(display(order.type))}</span><span className="ml-auto min-w-0 text-right text-brand-text-muted">{formatDate(order.created_at, dateLocale)}</span></div>
                    </CardContent>
                  </Card>;
                })}
              </div>
              <div className="hidden custom-scrollbar table-scroll md:block">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>{["Order", "Pair", "Side", "Type", "Price", "Quantity", "Status", "Created"].map((label) => <th key={label} className={label === "Price" || label === "Quantity" ? "num" : ""}>{t(label)}</th>)}</tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order, index) => {
                    const id = display(order.order_id ?? order.id, `#${index + 1}`);
                    const side = display(order.side);
                    return <tr key={id}>
                      <td className="mono max-w-[180px] truncate">{id}</td>
                      <td className="strong">{display(order.symbol)}</td>
                      <td><span className={side.toLowerCase() === "buy" ? "text-profit" : side.toLowerCase() === "sell" ? "text-loss" : "text-brand-text-secondary"}>{t(side)}</span></td>
                      <td>{display(order.type)}</td>
                      <td className="num">{display(order.price)}</td>
                      <td className="num">{display(order.quantity ?? order.amount)}</td>
                      <td><Badge className="whitespace-nowrap" variant={statusVariant(display(order.status, "unknown"))}>{t(display(order.status, "Unknown"))}</Badge></td>
                      <td className="text-xs text-brand-text-muted">{formatDate(order.created_at, dateLocale)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
