import { cn } from "../../lib/utils";

type TokenMarkProps = { symbol: string };

function TokenMark({ symbol }: TokenMarkProps) {
  switch (symbol) {
    case "BTC": return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#F7931A"/><path fill="#fff" d="M20.7 13.7c.3-2-1.2-3.1-3.2-3.8l.7-2.7-1.7-.4-.7 2.6-1.4-.3.7-2.6-1.7-.4-.7 2.7-3.4-.9-.5 2 1.2.3c.7.2.8.6.8.9l-2 7.8c-.1.4-.4.7-1 .5l-1.2-.3-.9 2.2 3.2.8-.7 2.7 1.7.4.7-2.6 1.4.4-.7 2.6 1.7.4.7-2.7c2.8.5 5 .3 5.8-2.2.7-2 .1-3.2-1.5-4 .9-.2 1.6-.9 1.8-2.3Zm-3.2 4.5c-.5 1.9-3.7.9-4.7.7l.9-3.4c1 .3 4.3.7 3.8 2.7Zm.5-4.6c-.5 1.7-3 .8-3.8.6l.8-3.1c.8.2 3.5.7 3 2.5Z"/></svg>;
    case "ETH": return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path fill="#fff" fillOpacity=".9" d="m16 4-7 11.6L16 20l7-4.4z"/><path fill="#fff" d="m16 20-7-4.4L16 28l7-12.4z"/><path fill="#fff" fillOpacity=".65" d="m16 4 7 11.6L16 20z"/><path fill="#fff" fillOpacity=".78" d="m16 20 7-4.4L16 28z"/></svg>;
    case "SOL": return <svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="sol-gradient" x1="3" x2="29" y1="28" y2="4" gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF"/><stop offset=".5" stopColor="#14F195"/><stop offset="1" stopColor="#00FFA3"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="#15151E"/><path fill="url(#sol-gradient)" d="M9.3 20.5a1 1 0 0 1 .7-.3h14.5c.9 0 1.3 1.1.7 1.7l-3.1 3.1a1 1 0 0 1-.7.3H6.8c-.9 0-1.3-1.1-.7-1.7l3.2-3.1ZM9.3 7.1a1 1 0 0 1 .7-.3h14.5c.9 0 1.3 1.1.7 1.7l-3.1 3.1a1 1 0 0 1-.7.3H6.8c-.9 0-1.3-1.1-.7-1.7l3.2-3.1Zm12.1 6.7a1 1 0 0 1 .7.3l3.1 3.1c.6.6.2 1.7-.7 1.7H10a1 1 0 0 1-.7-.3l-3.2-3.1c-.6-.6-.2-1.7.7-1.7h14.6Z"/></svg>;
    case "BNB": return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#F3BA2F"/><path fill="#fff" d="m16 7.1 3.1 3.1-3.1 3.1-3.1-3.1L16 7.1Zm-7.7 5.2 3.1 3.1-3.1 3.1-3.1-3.1 3.1-3.1Zm15.4 0 3.1 3.1-3.1 3.1-3.1-3.1 3.1-3.1ZM16 14.8l3.1 3.1-3.1 3.1-3.1-3.1 3.1-3.1Zm-7.7 5.1 3.1 3.1-3.1 3.1-3.1-3.1 3.1-3.1Zm15.4 0 3.1 3.1-3.1 3.1-3.1-3.1 3.1-3.1ZM16 22.5l3.1 3.1-3.1 3.1-3.1-3.1 3.1-3.1Z"/></svg>;
    case "XRP": return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#23292F"/><path fill="#fff" d="M8 9h3.1l4.9 4.8L20.9 9H24l-6.5 6.4a2.1 2.1 0 0 1-3 0L8 9Zm0 14h3.1l4.9-4.8 4.9 4.8H24l-6.5-6.4a2.1 2.1 0 0 0-3 0L8 23Z"/></svg>;
    case "DOGE": return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#C2A633"/><path fill="#fff" d="M12 7h5.2c5.6 0 8.8 3.2 8.8 8.9 0 5.8-3.3 9.1-8.9 9.1H12v-6H9v-2h3v-3H9v-2h3V7Zm3.1 5v5h3.1c2.9 0 4.5-1.7 4.5-4.1 0-2.3-1.6-3.9-4.5-3.9h-3.1Z"/></svg>;
    case "ADA": return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#0033AD"/><g fill="#fff"><circle cx="16" cy="16" r="2.1"/><circle cx="16" cy="8.1" r="1.2"/><circle cx="16" cy="23.9" r="1.2"/><circle cx="8.1" cy="16" r="1.2"/><circle cx="23.9" cy="16" r="1.2"/><circle cx="10.4" cy="10.4" r="1"/><circle cx="21.6" cy="10.4" r="1"/><circle cx="10.4" cy="21.6" r="1"/><circle cx="21.6" cy="21.6" r="1"/><circle cx="16" cy="11.6" r=".8"/><circle cx="16" cy="20.4" r=".8"/><circle cx="11.6" cy="16" r=".8"/><circle cx="20.4" cy="16" r=".8"/></g></svg>;
    case "AVAX": return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#E84142"/><path fill="#fff" d="m17.3 7.1 7.1 12.3c.5.9-.1 2-1.1 2H18c-1.1 0-1.7-1.1-1.1-2l2.7-4.7-2.3-4-5.2 9c-.5.9-1.9.9-2.4 0l-2.1-3.6c-.2-.4-.2-.9 0-1.3l4.3-7.7c.5-.9 1.8-.9 2.3 0l1.8 3.1 1.3-2.3Z"/></svg>;
    case "USDT": return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#26A17B"/><path fill="#fff" d="M8 8h16v3H18v2.1c4.3.2 7.3 1.1 7.3 2.2 0 1.2-4.2 2.2-9.3 2.2s-9.3-1-9.3-2.2c0-1.1 3-2 7.3-2.2V11H8V8Zm6 9.8v5.5h4v-5.5c3.2-.1 5.5-.7 5.5-1.5 0-.8-3.4-1.5-7.5-1.5s-7.5.7-7.5 1.5c0 .8 2.3 1.4 5.5 1.5Z"/></svg>;
    default: return null;
  }
}

export function TokenIcon({ symbol, className }: { symbol: string; className?: string }) {
  const ticker = symbol.trim().toUpperCase();
  const mark = <TokenMark symbol={ticker} />;
  return <span className={cn("relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border-subtle bg-brand-surface-2", className)} role="img" aria-label={`${ticker} token`}>
    {mark || <span className="text-[10px] font-bold leading-none text-brand-text-secondary">{ticker.slice(0, 3)}</span>}
  </span>;
}
