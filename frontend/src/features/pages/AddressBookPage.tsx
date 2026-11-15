import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Wallet, Landmark, RefreshCw } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useI18n, localeTags } from "../../lib/i18n";
import { addAddress, getSavedCryptoAddresses, type SavedAddress, type SavedCryptoAddress, type BankAddress } from "../../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { PageFrame } from "./Pages";

const COIN_NETWORKS: Record<string, string[]> = {
  BTC: ["BTC"],
  ETH: ["ERC20"],
  USDT: ["TRC20", "ERC20", "BEP20"],
  SOL: ["SOL"],
  BNB: ["BEP20"],
  USDC: ["ERC20"],
};
const COINS = Object.keys(COIN_NETWORKS);

function statusBadge(item: SavedAddress, t: (key: string) => string) {
  if (item.blocked) return <Badge variant="destructive">{t("Blocked")}</Badge>;
  if (item.unbound) return <Badge variant="destructive">{t("Unbound")}</Badge>;
  return <Badge variant="outline">{t("Saved")}</Badge>;
}

export function AddressBookPage() {
  const { t, language } = useI18n();
  const { status } = useAuth();
  const [items, setItems] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<"crypto" | "bank">("crypto");
  const [coin, setCoin] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [swift, setSwift] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); setItems([]); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    getSavedCryptoAddresses(controller.signal)
      .then((list) => { if (!controller.signal.aborted) setItems(list); })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (!controller.signal.aborted) { setItems([]); setError(reason instanceof Error ? reason.message : "Address book is temporarily unavailable."); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, reload]);

  const networks = useMemo(() => COIN_NETWORKS[coin] ?? [], [coin]);

  useEffect(() => {
    if (!networks.includes(network)) setNetwork(networks[0] ?? "");
  }, [networks, network]);

  const resetForm = () => {
    setAddress(""); setNote("");
    setAccountHolder(""); setBankName(""); setAccountNumber(""); setRoutingNumber(""); setSwift(""); setBankAddress("");
    setFormError(""); setFormMessage("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFormError(""); setFormMessage("");
    setSubmitting(true);
    try {
      if (tab === "crypto") {
        await addAddress({ type: "crypto", coin, network, address: address.trim(), note: note.trim() || undefined });
      } else {
        await addAddress({
          type: "bank", account_holder: accountHolder.trim(), bank_name: bankName.trim(),
          account_number: accountNumber.replace(/\s/g, ""), routing_number: routingNumber.replace(/\s/g, ""),
          swift: swift.trim() ? swift.trim().toUpperCase() : undefined, bank_address: bankAddress.trim(),
          note: note.trim() || undefined,
        });
      }
      setFormMessage(t("Address added successfully."));
      resetForm();
      setReload((n) => n + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Your address could not be added.");
    } finally {
      setSubmitting(false);
    }
  };

  const date = (raw?: string) => {
    if (!raw) return "—";
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString(localeTags[language]);
  };

  const signedOut = status !== "authenticated";
  const inputCls = "h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15";

  return (
    <PageFrame title={t("Address book")} tone="assets" backTo="/me">
      {signedOut ? (
        <Card className="border-brand-border bg-brand-surface">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <Wallet className="h-6 w-6 text-brand-text-muted" />
            <p className="text-sm font-semibold text-brand-text">{t("Sign in to manage your address book")}</p>
            <p className="max-w-md text-xs text-brand-text-muted">{t("Save crypto withdrawal addresses and bank payout methods for faster, safer withdrawals.")}</p>
            <Button asChild className="mt-2"><Link to="/login">{t("Sign in")}</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
            <CardHeader className="border-b border-brand-border bg-brand-surface-2/60">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><Plus className="h-5 w-5" /></span>
                <div><CardTitle>{t("Add an address")}</CardTitle><CardDescription>{t("Choose a crypto address or a bank payout method.")}</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="inline-flex rounded-lg border border-brand-border p-1">
                <button type="button" onClick={() => { setTab("crypto"); resetForm(); }} className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${tab === "crypto" ? "bg-brand-accent/15 text-brand-accent" : "text-brand-text-muted hover:text-brand-text"}`}>{t("Crypto address")}</button>
                <button type="button" onClick={() => { setTab("bank"); resetForm(); }} className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${tab === "bank" ? "bg-brand-accent/15 text-brand-accent" : "text-brand-text-muted hover:text-brand-text"}`}>{t("Bank account")}</button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {tab === "crypto" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Asset")}</span>
                      <select value={coin} onChange={(e) => setCoin(e.target.value)} className={inputCls}>{COINS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                    </label>
                    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Network")}</span>
                      <select value={network} onChange={(e) => setNetwork(e.target.value)} className={inputCls}>{networks.map((n) => <option key={n} value={n}>{n}</option>)}</select>
                    </label>
                    <label className="space-y-1.5 text-sm sm:col-span-2"><span className="text-brand-text-muted">{t("Address")}</span>
                      <input value={address} onChange={(e) => setAddress(e.target.value)} required placeholder={t("Paste the destination address")} className={inputCls} />
                    </label>
                  </div>
                ) : (

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Account holder")}</span>
                      <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required placeholder={t("Full name on the account")} className={inputCls} />
                    </label>
                    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Bank name")}</span>
                      <input value={bankName} onChange={(e) => setBankName(e.target.value)} required placeholder={t("Your bank")} className={inputCls} />
                    </label>
                    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Account number")}</span>
                      <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required inputMode="numeric" placeholder={t("4–34 digits")} className={inputCls} />
                    </label>
                    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Routing number")}</span>
                      <input value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} required inputMode="numeric" placeholder={t("9 digits")} className={inputCls} />
                    </label>
                    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("SWIFT / BIC (optional)")}</span>
                      <input value={swift} onChange={(e) => setSwift(e.target.value)} placeholder={t("8 or 11 characters")} className={inputCls} />
                    </label>
                    <label className="space-y-1.5 text-sm sm:col-span-2"><span className="text-brand-text-muted">{t("Bank address")}</span>
                      <input value={bankAddress} onChange={(e) => setBankAddress(e.target.value)} required placeholder={t("Bank branch address")} className={inputCls} />
                    </label>
                  </div>
                )}

                <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Note (optional)")}</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder={t("A short label for this address")} className={inputCls} />
                </label>

                {formError ? <p role="alert" className="text-sm text-brand-danger">{t(formError)}</p> : null}
                {formMessage ? <p role="status" className="text-sm text-brand-success">{formMessage}</p> : null}

                <Button type="submit" disabled={submitting} className="min-h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                  {submitting ? t("Submitting…") : t("Add address")}
                </Button>
              </form>
            </CardContent>
          </Card>


          <Card className="overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
            <CardHeader className="border-b border-brand-border bg-brand-surface-2/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{t("Saved addresses")}</CardTitle>
                <Button size="sm" variant="outline" disabled={loading} onClick={() => setReload((n) => n + 1)}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("Refresh")}</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? <p className="p-6 text-center text-sm text-brand-text-muted" role="status">{t("Loading address book…")}</p>
                : error ? <div className="rounded-xl border border-brand-danger/30 bg-brand-surface p-5"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => setReload((n) => n + 1)}>{t("Try again")}</Button></div>
                : items.length === 0 ? <p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No addresses have been saved yet.")}</p>
                : items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-brand-border p-3">
                      {item.type === "crypto" ? <CryptoRow item={item} t={t} date={date} /> : <BankRow item={item} t={t} date={date} />}
                    </div>
                  ))}
            </CardContent>
          </Card>
        </div>
      )}
    </PageFrame>
  );
}

function CryptoRow({ item, t, date }: { item: SavedCryptoAddress; t: (k: string) => string; date: (raw?: string) => string }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-brand-accent" />{item.coin} · {item.network}</span>
        {statusBadge(item, t)}
      </div>
      <p className="mt-2 break-all font-mono text-sm text-brand-text-muted">{item.address}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        {item.note ? <p className="text-xs text-brand-text-muted">{item.note}</p> : <span />}
        <span className="text-xs text-brand-text-muted">{date(item.created_at)}</span>
      </div>
    </div>
  );
}

function BankRow({ item, t, date }: { item: BankAddress; t: (k: string) => string; date: (raw?: string) => string }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4 text-brand-teal" />{item.bank_name}</span>
        {statusBadge(item, t)}
      </div>
      <p className="mt-2 text-sm text-brand-text-secondary">{item.account_holder} · {t("Account")} {item.account_number}</p>
      {item.routing_number ? <p className="mt-1 text-xs text-brand-text-muted">{t("Routing")} {item.routing_number}{item.swift ? ` · SWIFT ${item.swift}` : ""}</p> : null}
      <div className="mt-1 flex items-center justify-between gap-2">
        {item.note ? <p className="text-xs text-brand-text-muted">{item.note}</p> : <span />}
        <span className="text-xs text-brand-text-muted">{date(item.created_at)}</span>
      </div>
    </div>
  );
}
