import { useEffect, useRef, useState } from "react";

/** Connection state surfaced to the UI so a dead stream is never silent. */
export type StreamState = "idle" | "connecting" | "live" | "degraded" | "closed";

export interface StreamOptions<T> {
  /** Stream channel, e.g. "depth" or "trades". */
  channel: "depth" | "trades";
  /** Full pair symbol such as BTCUSDT. */
  symbol: string;
  /** Set false to avoid opening the connection at all. */
  enabled?: boolean;
  /** Validates one update frame; return null to drop it. */
  parse: (payload: unknown) => T | null;
}

export interface StreamResult<T> {
  data: T | null;
  state: StreamState;
  /** Machine-readable code from the last `error` frame, if any. */
  errorCode: string | null;
  /** Local receipt time of the most recent validated frame. */
  updatedAt: number | null;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "")) || "/api";

/**
 * Subscribes to one server-sent event stream.
 *
 * EventSource already reconnects on transport failure, so we only manage:
 *   - lifecycle (close on unmount / channel change)
 *   - mapping server `error` frames to a `degraded` state instead of a silent gap
 *   - discarding frames that fail validation rather than rendering junk
 *
 * No polling fallback here on purpose: the caller decides whether to fall back
 * to the polled endpoint, so we never run two data paths by accident.
 */
export function useMarketStreamEvent<T>({ channel, symbol, enabled = true, parse }: StreamOptions<T>): StreamResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<StreamState>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const parseRef = useRef(parse);
  parseRef.current = parse;

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("connecting");
    setErrorCode(null);
    setData(null);
    setUpdatedAt(null);

    const source = new EventSource(
      `${API_BASE}/stream/${channel}?symbol=${encodeURIComponent(symbol)}`,
      { withCredentials: true },
    );

    const onUpdate = (event: MessageEvent<string>) => {
      if (cancelled) return;
      let payload: unknown;
      try { payload = JSON.parse(event.data); } catch { return; }
      const parsed = parseRef.current(payload);
      if (parsed === null) return;
      setData(parsed);
      setUpdatedAt(Date.now());
      setState("live");
      setErrorCode(null);
    };

    // `EventSource.onerror` is the transport-level signal and carries no data,
    // so server-side failures travel on a distinct `stream-error` event. Mixing
    // both onto `error` would make one handler shadow the other.
    const onServerError = (event: MessageEvent<string>) => {
      if (cancelled) return;
      let code = "STREAM_ERROR";
      try {
        const payload = JSON.parse(event.data) as { code?: string };
        if (payload && typeof payload.code === "string") code = payload.code;
      } catch { /* keep the default code */ }
      setErrorCode(code);
      setState("degraded");
    };

    const onOpen = () => { if (!cancelled) setState((prev) => (prev === "live" ? prev : "connecting")); };
    const onTransportError = () => {
      if (cancelled) return;
      // EventSource retries automatically; report the gap but keep it alive.
      setState("degraded");
      setErrorCode("TRANSPORT_ERROR");
    };
    const onBye = () => { if (!cancelled) setState("closed"); };

    source.addEventListener("update", onUpdate as EventListener);
    source.addEventListener("stream-error", onServerError as EventListener);
    source.addEventListener("bye", onBye as EventListener);
    source.addEventListener("open", onOpen as EventListener);
    source.addEventListener("error", onTransportError as EventListener);

    return () => {
      cancelled = true;
      source.removeEventListener("update", onUpdate as EventListener);
      source.removeEventListener("stream-error", onServerError as EventListener);
      source.removeEventListener("bye", onBye as EventListener);
      source.removeEventListener("open", onOpen as EventListener);
      source.removeEventListener("error", onTransportError as EventListener);
      source.close();
    };
  }, [channel, symbol, enabled]);

  return { data, state, errorCode, updatedAt };
}
