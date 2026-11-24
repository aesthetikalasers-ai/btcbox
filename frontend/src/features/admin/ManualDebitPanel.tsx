import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, adminAdjustUserBalance, type AdminUserRecord } from "../../lib/api";

interface ManualDebitPanelProps {
  token: string;
  actorId: string;
  user: AdminUserRecord;
  coins: string[];
  canAdjust: boolean;
  onComplete: () => void;
}

const amountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

export function ManualDebitPanel({ token, actorId, user, coins, canAdjust, onComplete }: ManualDebitPanelProps) {
  const [coin, setCoin] = useState(coins[0] || "USDT");
  const [amount, setAmount] = useState("");
  const [requestId, setRequestId] = useState("");
  const [requestIntent, setRequestIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lockRef = useRef(false);
  const storageKey = "btcbox.admin.manual-debit.v1." + actorId + "." + user.uid + "." + coin;

  useEffect(() => {
    setError("");
    setNotice("");
    setAmount("");
    setRequestId("");
    setRequestIntent("");
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      if (saved && saved.version === 1 && saved.actor_id === actorId &&
          saved.uid === user.uid && saved.coin === coin &&
          typeof saved.amount === "string" && typeof saved.request_id === "string") {
        setAmount(saved.amount);
        setRequestId(saved.request_id);
        setRequestIntent([user.uid, coin, saved.amount].join("|"));
      } else {
        setRequestId("");
        setRequestIntent("");
      }
    } catch {
      setError("A saved debit request could not be read. Check the audit log before retrying.");
    }
  }, [storageKey, actorId, user.uid, coin]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lockRef.current || busy || !canAdjust) return;
    if (user.financial_balance_source !== "postgres_financial_ledger") {
      setError("Manual debit is unavailable until the PostgreSQL ledger balance source is confirmed.");
      return;
    }
    const normalizedAmount = amount.trim();
    if (!amountPattern.test(normalizedAmount) || /^0(?:\.0*)?$/.test(normalizedAmount)) {
      setError("Enter a positive debit amount.");
      return;
    }
    let nextRequestId = requestId;
    const intent = [user.uid, coin, normalizedAmount].join("|");
    if (!nextRequestId || requestIntent !== intent) {
      try { nextRequestId = window.crypto.randomUUID(); }
      catch {
        setError("Secure debit request IDs are unavailable in this browser. No debit was sent.");
        return;
      }
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: 1, actor_id: actorId, uid: user.uid, coin,
        amount: normalizedAmount, request_id: nextRequestId,
      }));
    } catch {
      setError("This browser cannot safely save the debit request. No debit was sent.");
      return;
    }

    lockRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setRequestId(nextRequestId);
    setRequestIntent(intent);
    try {
      const result = await adminAdjustUserBalance(token, {
        uid: user.uid, coin, delta: "-" + normalizedAmount, mode: "adjust", request_id: nextRequestId,
      });
      try { window.localStorage.removeItem(storageKey); } catch {}
      setRequestId("");
      setRequestIntent("");
      setAmount("");
      setNotice(result.duplicate ? "This debit was already recorded; it was not applied again." : "Manual debit recorded.");
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Manual debit could not be confirmed. Retry the same saved request.");
      if (reason instanceof ApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 409) {
        try { window.localStorage.removeItem(storageKey); } catch {}
        setRequestId("");
        setRequestIntent("");
      }
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  };

  const available = user.balances?.[coin]?.free;
  return <section className="mb-4 rounded-xl border border-brand-border bg-brand-surface-2/40 p-3">
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-brand-text">Manual debit</h3>
      <p className="mt-1 text-xs text-brand-text-muted">A debit may take the available balance below zero. No reason field is required.</p>
    </div>
    {!canAdjust ? <p className="text-xs text-brand-text-muted">Your administrator role does not include manual balance adjustment.</p> :
      user.financial_balance_source !== "postgres_financial_ledger" ?
        <p className="text-xs text-brand-warning">Manual debit is disabled until the PostgreSQL ledger balance source is confirmed.</p> :
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[minmax(100px,0.7fr)_minmax(120px,1fr)_auto]">
          <label className="space-y-1 text-xs text-brand-text-muted">
            <span>Asset</span>
            <select value={coin} onChange={event => { setCoin(event.target.value); setAmount(""); setRequestId(""); setRequestIntent(""); }}
              disabled={busy} className="h-10 w-full rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-brand-text">
              {coins.map(asset => <option key={asset} value={asset}>{asset}</option>)}
            </select>
            <span className="block">Available: {available == null ? "—" : String(available)}</span>
          </label>
          <label className="space-y-1 text-xs text-brand-text-muted">
            <span>Debit amount</span>
            <input value={amount} onChange={event => setAmount(event.target.value)} disabled={busy}
              inputMode="decimal" placeholder="Amount" className="h-10 w-full rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-brand-text" />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy || !amount.trim()} className="h-10 w-full rounded-lg bg-brand-danger px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Processing…" : requestId ? "Retry same debit" : "Confirm debit"}
            </button>
          </div>
        </form>}
    {error ? <p role="alert" className="mt-2 text-xs text-brand-danger">{error}</p> : null}
    {notice ? <p role="status" className="mt-2 text-xs text-brand-success">{notice}</p> : null}
  </section>;
}
