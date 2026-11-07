import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ClipboardList, RefreshCw } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { ApiError, getOrders, type OrderRecord } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

function display(value: unknown, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function statusVariant(status: string) {
  const value = status.toLowerCase();
  if (["filled", "completed", "success", "closed"].includes(value)) return "success" as const;
  if (["cancelled", "canceled", "rejected", "failed", "expired"].includes(value)) return "destructive" as const;
  if (["pending", "open", "partially_filled", "processing", "submitted"].includes(value)) return "warning" as const;
  return "outline" as const;
}

export function OrdersPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    setSignedOut(false);
    try {
      const rows = await getOrders(signal);
      if (!signal?.aborted) setOrders(rows);
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (signal?.aborted) return;
      if (reason instanceof ApiError && reason.code === "AUTH_REQUIRED") {
        setOrders([]);
        setSignedOut(true);
        setError(t("Sign in to view your order history."));
      } else {
        // Preserve the last confirmed history during a transient refresh failure.
        setError(t("Order history is temporarily unavailable."));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  return (
    <div className="tone-orders mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-brand-border bg-brand-surface-raised p-4 shadow-sm sm:p-5">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-secondary">{t("BTCBOX / ACCOUNT")}</p>
          <h1 className="type-page-title text-brand-text">{t("Orders")}</h1>
          <p className="type-body mt-2 text-brand-text-secondary">{t("Your order history from the authenticated BTCBOX account service.")}</p>
        </div>
        <Button variant="outline" size="default" className="w-full sm:w-auto" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("Refresh")}
        </Button>
      </div>

      {error && (
        <Card className="border-brand-danger/25 bg-brand-danger/[0.035]">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="type-body-compact text-brand-text-secondary" role="alert">{error}</p>
            {signedOut && <Button asChild size="default" className="w-full sm:w-auto"><Link to="/login">{t("Sign in")} <ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button>}
          </CardContent>
        </Card>
      )}

      <Card className="border-brand-border bg-brand-surface">
        <CardHeader className="border-b border-brand-border/70 bg-brand-surface-2/45">
          <CardTitle>{t("Order history")}</CardTitle>
          <CardDescription>{t("Your recent orders and their current status.")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5" role="status" aria-live="polite">
              <div className="h-4 w-1/3 animate-pulse rounded bg-brand-surface-2" />
              <div className="h-12 animate-pulse rounded bg-brand-surface-2" />
              <div className="h-12 animate-pulse rounded bg-brand-surface-2" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <ClipboardList className="mb-3 h-9 w-9 text-brand-text-muted" />
              <p className="type-card-title text-brand-text">{t(signedOut ? "Sign in required" : error ? "Orders could not be loaded" : "No orders yet")}</p>
              <p className="type-body-compact mt-2 max-w-md text-brand-text-muted">{t(signedOut ? "Your private order history is available after you sign in." : error ? "Refresh after the account service is available. Your order records have not been changed." : "When you place an order, its status and details will appear here.")}</p>
            </div>
          ) : (
            <div role="region" tabIndex={0} aria-label={t("Scrollable order history table")} className="custom-scrollbar overflow-x-auto rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/40">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-y border-brand-border bg-brand-surface-2 text-[11px] font-semibold uppercase tracking-[.08em] text-brand-text-muted">
                  <tr>{["Order", "Pair", "Side", "Type", "Price", "Quantity", "Status", "Created"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">{t(label)}</th>)}</tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const id = display(order.order_id ?? order.id, `#${index + 1}`);
                    const side = display(order.side);
                    return <tr key={id} className="border-b border-brand-border last:border-0 transition-colors duration-150 hover:bg-brand-surface-hover">
                      <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-brand-text-secondary">{id}</td>
                      <td className="px-4 py-3 font-semibold text-brand-text">{display(order.symbol)}</td>
                      <td className="px-4 py-3"><span className={side.toLowerCase() === "buy" ? "text-profit" : side.toLowerCase() === "sell" ? "text-loss" : "text-brand-text-secondary"}>{t(side)}</span></td>
                      <td className="px-4 py-3 text-brand-text-secondary">{display(order.type)}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-brand-text">{display(order.price)}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-brand-text-secondary">{display(order.quantity ?? order.amount)}</td>
                      <td className="px-4 py-3"><Badge className="min-w-[76px] justify-center" variant={statusVariant(display(order.status, "unknown"))}>{t(display(order.status, "Unknown"))}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-brand-text-muted">{display(order.created_at)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
