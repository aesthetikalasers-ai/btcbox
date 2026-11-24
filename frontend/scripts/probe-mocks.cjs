/** Shared API mocks for local layout probes (signed-out visitor, live-ish data). */
module.exports = async function mock(page) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (pathname === "/api/auth-client-config") return json({ ok: true, supabase_url: "https://e2e.invalid", publishable_key: "x", google_enabled: false, wallet_enabled: false });
    if (pathname === "/api/account") return json({ ok: false, need_login: true }, 401);
    if (pathname === "/api/market") {
      const now = Math.floor(Date.now() / 1000);
      return json({
        ok: true,
        markets: [
          { sym: "BTC", price: 65320.42, chg: 2.14, high: 66180, low: 63890, vol: "1842.55", source: "provider" },
          { sym: "ETH", price: 3210.8, chg: -0.82, high: 3288, low: 3172, vol: "21480", source: "provider" },
        ],
        data: { BTC: { ts: now, providerTs: now, source: "provider" }, ETH: { ts: now, providerTs: now, source: "provider" } },
      });
    }
    if (pathname === "/api/market/pairs") return json({ ok: true, pairs: [{ base_asset: "BTC", quote_asset: "USDT" }, { base_asset: "ETH", quote_asset: "USDT" }] });
    if (pathname === "/api/kline") {
      const now = Math.floor(Date.now() / 1000);
      const klines = [];
      let price = 64000;
      for (let i = 59; i >= 0; i -= 1) {
        const open = price;
        price += (Math.random() - 0.4) * 260;
        klines.push({ time: (now - i * 3600) * 1000, open, high: Math.max(open, price) + 60, low: Math.min(open, price) - 60, close: price, volume: 200 });
      }
      return json({ ok: true, source: "provider", klines });
    }
    if (pathname === "/api/depth") {
      const bids = [];
      const asks = [];
      for (let i = 0; i < 40; i += 1) {
        bids.push([(65320 - i * 3.7).toFixed(2), (0.4 + Math.random() * 2.6).toFixed(4)]);
        asks.push([(65322 + i * 3.9).toFixed(2), (0.35 + Math.random() * 2.2).toFixed(4)]);
      }
      return json({ ok: true, source: "provider", snapshotTs: Math.floor(Date.now() / 1000), bids, asks });
    }
    if (pathname === "/api/trading/status") return json({ ok: true, spot_order_entry_enabled: false, spot_cancel_enabled: false, supported_order_types: ["limit"] });
    if (pathname === "/api/orders") return json({ ok: true, orders: [] });
    return json({ ok: true });
  });
  await page.route("**/api/stream/**", (route) => route.abort());
};