import { useEffect, useRef, useState, type FormEvent } from "react";
import { Headset, Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { getSupportMessages, sendSupportMessage, type SupportMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { localeTags, useI18n } from "../../lib/i18n";

/**
 * Customer support conversation.
 *
 * History, pending sends and in-flight responses are scoped to the signed-in
 * account. A retry keeps the same request ID and exact message body across a
 * page refresh, while account changes immediately hide the previous thread.
 */
export function SupportChat() {
  const { t, language } = useI18n();
  const { status, email } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messagesAccountKey, setMessagesAccountKey] = useState("");
  const [loading, setLoading] = useState(status === "authenticated");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState("");
  const [pendingRequestContent, setPendingRequestContent] = useState("");
  const [pendingRequestAccountKey, setPendingRequestAccountKey] = useState("");
  const [sendError, setSendError] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const currentAccountKeyRef = useRef("");

  const pendingStorageKey = status === "authenticated" && email.trim()
    ? "btcbox.support.pending.v1." + email.trim().toLowerCase()
    : "";
  currentAccountKeyRef.current = pendingStorageKey;

  useEffect(() => {
    if (status !== "authenticated" || !pendingStorageKey) {
      setLoading(false);
      setMessages([]);
      setMessagesAccountKey("");
      setPendingRequestId("");
      setPendingRequestContent("");
      setPendingRequestAccountKey("");
      setSending(false);
      return;
    }

    const requestAccountKey = pendingStorageKey;
    const controller = new AbortController();
    setLoading(true);
    setMessages([]);
    setMessagesAccountKey("");
    setError("");
    setSendError("");
    setSendMessage("");
    setSending(false);

    try {
      const raw = window.sessionStorage.getItem(pendingStorageKey);
      if (raw) {
        const pending = JSON.parse(raw) as { request_id?: unknown; content?: unknown };
        if (
          typeof pending.request_id === "string" &&
          /^[A-Za-z0-9_-]{16,100}$/.test(pending.request_id) &&
          typeof pending.content === "string" &&
          pending.content.trim().length > 0 &&
          pending.content.length <= 2000
        ) {
          setPendingRequestId(pending.request_id);
          setPendingRequestContent(pending.content);
          setPendingRequestAccountKey(pendingStorageKey);
        } else {
          window.sessionStorage.removeItem(pendingStorageKey);
          setPendingRequestId("");
          setPendingRequestContent("");
          setPendingRequestAccountKey("");
        }
      } else {
        setPendingRequestId("");
        setPendingRequestContent("");
        setPendingRequestAccountKey("");
      }
    } catch {
      setError("A pending support message could not be restored. Please check the conversation before sending again.");
    }

    getSupportMessages(controller.signal).then(list => {
      if (!controller.signal.aborted && currentAccountKeyRef.current === requestAccountKey) {
        setMessages(list);
        setMessagesAccountKey(requestAccountKey);
        setError("");
      }
    }).catch((reason: unknown) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (!controller.signal.aborted && currentAccountKeyRef.current === requestAccountKey) {
        setMessages([]);
        setMessagesAccountKey(requestAccountKey);
        setError(reason instanceof Error ? reason.message : "Support conversation is temporarily unavailable.");
      }
    }).finally(() => {
      if (!controller.signal.aborted && currentAccountKeyRef.current === requestAccountKey) setLoading(false);
    });
    return () => controller.abort();
  }, [status, email, reload, pendingStorageKey]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Poll for staff replies while the current customer's conversation is open.
  useEffect(() => {
    if (status !== "authenticated" || !pendingStorageKey) return;
    const timer = window.setInterval(() => setReload(n => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [status, pendingStorageKey]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const requestAccountKey = pendingStorageKey;
    if (status !== "authenticated" || !requestAccountKey) {
      setSendError("Sign in to send a support message.");
      return;
    }

    const hasPending = pendingRequestAccountKey === requestAccountKey && !!pendingRequestId;
    const message = hasPending ? pendingRequestContent : draft.trim();
    if (!message) return;

    let requestId = hasPending ? pendingRequestId : "";
    if (!requestId) {
      try { requestId = window.crypto.randomUUID(); }
      catch {
        setSendError("Secure request IDs are unavailable in this browser. No message was sent.");
        return;
      }
    }

    try {
      window.sessionStorage.setItem(pendingStorageKey, JSON.stringify({ request_id: requestId, content: message }));
    } catch {
      setSendError("This browser cannot safely retain the pending message. No message was sent.");
      return;
    }

    setPendingRequestId(requestId);
    setPendingRequestContent(message);
    setPendingRequestAccountKey(requestAccountKey);
    setSending(true);
    setSendError("");
    setSendMessage("");

    try {
      const result = await sendSupportMessage(message, requestId);
      try { window.sessionStorage.removeItem(pendingStorageKey); } catch { /* Keep the in-memory result; a stale entry is idempotent. */ }
      if (currentAccountKeyRef.current !== requestAccountKey) return;

      setDraft("");
      setPendingRequestId("");
      setPendingRequestContent("");
      setPendingRequestAccountKey("");
      setMessagesAccountKey(requestAccountKey);
      if (!result.duplicate) {
        setMessages(current => [...current, {
          id: result.message_id || requestId,
          from: "user",
          content: message,
          time: result.time || new Date().toISOString(),
        }]);
      }
      setSendMessage(result.duplicate ? t("Your message was already received.") : t("Message sent."));
      setReload(n => n + 1);
    } catch (reason) {
      if (currentAccountKeyRef.current === requestAccountKey) {
        setSendError(reason instanceof Error ? reason.message : "Your message could not be sent.");
      }
    } finally {
      if (currentAccountKeyRef.current === requestAccountKey) setSending(false);
    }
  };

  const visibleMessages = messagesAccountKey === pendingStorageKey ? messages : [];
  const date = (raw?: string) => {
    if (!raw) return "—";
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString(localeTags[language]);
  };

  return (
    <Card className="self-start overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] lg:sticky lg:top-6">
      <CardHeader className="border-b border-brand-border bg-brand-surface-2/60">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
            <Headset className="h-5 w-5" />
          </span>
          <div>
            <CardTitle>{t("Your conversation")}</CardTitle>
            <CardDescription>{t("Ask about deposits, withdrawals, verification, or account issues.")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4">
        {loading ? <p role="status" className="text-sm text-brand-text-muted">{t("Loading…")}</p> : null}
        {error ? <p role="alert" className="text-sm text-brand-danger">{t(error)}</p> : null}
        <div ref={listRef} className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {visibleMessages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-brand-border p-4 text-sm text-brand-text-muted">
              {t("No messages yet. Start a conversation below.")}
            </p>
          ) : visibleMessages.map(item => (
            <div key={item.id} className={`flex ${item.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${item.from === "user" ? "bg-brand-accent/15 text-brand-text" : "bg-brand-surface-2 text-brand-text-secondary"}`}>
                <p className="whitespace-pre-wrap break-words">{item.content}</p>
                <p className="mt-1 text-[10px] text-brand-text-muted">{date(item.time)}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="space-y-2">
          <textarea
            value={pendingRequestAccountKey === pendingStorageKey && pendingRequestId ? pendingRequestContent : draft}
            onChange={event => setDraft(event.target.value)}
            disabled={sending || (pendingRequestAccountKey === pendingStorageKey && !!pendingRequestId)}
            maxLength={2000}
            rows={3}
            placeholder={t("Type your message (1–2,000 characters)")}
            className="w-full resize-none rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15"
          />
          {sendError ? <p role="alert" className="text-sm text-brand-danger">{sendError}</p> : null}
          {sendMessage ? <p role="status" className="text-sm text-brand-success">{sendMessage}</p> : null}
          <div className="flex items-center justify-end">
            <span className="text-[11px] tabular-nums text-brand-text-muted">{draft.length}/2000</span>
          </div>
          <Button type="submit" disabled={sending || (!draft.trim() && !(pendingRequestAccountKey === pendingStorageKey && pendingRequestId))} className="min-h-11 w-full">
            <Send className="mr-2 h-4 w-4" />
            {sending ? t("Sending…") : pendingRequestAccountKey === pendingStorageKey && pendingRequestId ? t("Retry same request") : t("Send message")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
