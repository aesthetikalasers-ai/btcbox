robe: opens the desktop trading terminal against the REAL local market
  * gateway(backend / market - server.js on : 8080) with NO API mocking, then reports
    * every / api request outcome plus what actually rendered.
 *
 * Usage: node scripts / probe - live - terminal.cjs[width][height][baseUrl][--mock]
  * node scripts / probe - live - terminal.cjs 1920 1080 http://127.0.0.1:4173
 *
 * With`--mock` every `/api/*` call is served by scripts / probe - mocks.cjs instead
  * of the real gateway.Note this mirrors a real e2e wrinkle: `page.route`
    * matches the request URL as issued, so a mock registered for `**\/api/**`
      * still intercepts`http://127.0.0.1:8080/api/...`(that pattern matches any
        * substring), while `url.pathname === "/api/market"` checks inside the handler
          * still line up.Cross - origin mocks must therefore also stub the CORS preflight.
 *
 * Purpose: distinguish "layout broke" from "data never arrived" when the chart
  * or order book looks empty.Prints a verdict block at the end.
 */
const { chromium } = require("@playwright/test");

(async () => {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const useMock = process.argv.includes("--mock");
  const width = Numb(args[0] || 1920);
  const height = Number(args[1] || 1080);
  const base = args[2] || "http://127.0.0.1:4173";

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  if (useMock) {
    const mock = require("./probe-mocks.cjs");
    await mock(page);
    // Print the URL exactly as Playwright sees it, so a cross-origin
    // `VITE_API_BASE_URL` cannot be mistaken for a same-origin `/api` call.
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/")) console.log("[mock-req]", req.url(), "| headers:", JSON.stringify(req.headers()["origin"] ?? "no-origin"));
    });
  }
  await page.addInitScript(() => {
    window.localStorage.setItem("btcbox-language", "en");
    // A real visitor has never toggled the demo preview. Clear it so the probe
    // measures live-gateway behaviour, not the offline fixture.
    window.localStorage.removeItem("btcbox-demo-preview");
  });

  const api = [];
  const anyReq = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith("http")) anyReq.push(url.pathname + url.search);
  });
  page.on("requestfailed", (req) => {
    api.push({ path: new URL(req.url()).pathname, failed: req.failure()?.errorText });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") api.push({ path: "<console>", msg: msg.text().slice(0, 200) });
  });
  page.on("response", async (res) => {
    const url = new URL(res.url());
    if (!url.pathname.startsWith("/api/")) return;
    let body = null;
    try {
      body = await res.text();
    } catch {
      body = "<unreadable>";
    }
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }
    api.push({
      path: url.pathname + (url.search || ""),
      status: res.status(),
      ok: parsed ? parsed.ok : null,
      code: parsed ? parsed.code : null,
      msg: parsed ? (parsed.msg || null) : (body || "").slice(0, 120),
      counts: parsed
        ? {
          klines: Array.isArray(parsed.klines) ? parsed.klines.length : undefined,
          bids: Array.isArray(parsed.bids) ? parsed.bids.length : undefined,
          asks: Array.isArray(parsed.asks) ? parsed.asks.length : undefined,
          markets: Array.isArray(parsed.markets) ? parsed.markets.length : undefined,
        }
        : null,
    });
  });
  page.on("pageerror", (err) => api.push({ path: "<pageerror>", msg: String(err.message).slice(0, 200) }));

  await page.goto(base + "/" + (process.env.PROBE_ROUTE || "trade/BTCUSDT"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  const render = await page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    };
    const labelEl = [...document.querySelectorAll("label")].find((l) => /Limit price/i.test(l.textContent || ""));
    const priceInput = labelEl ? document.getElementById(labelEl.htmlFor) || labelEl.querySelector("input") : null;
    const bookBody = document.querySelector(".term-book-body");
    const rows = [...document.querySelectorAll(".term-book-body .spot-book-row")];
    const chartBody = document.querySelector(".term-chart-body");
    const candleHost = chartBody?.querySelector(".trade-candles");
    const bottom = document.querySelector(".term-bottom");
    const rt = document.querySelector(".term-rt");
    const inViewport = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        h: Math.round(r.height),
        // Fully visible means the panel's bottom sits above the viewport edge.
        fullyVisible: r.top >= 0 && r.bottom <= window.innerHeight + 1,
        truncatedBy: Math.round(Math.max(0, r.bottom - window.innerHeight)),
      };
    };
    return {
      viewportH: window.innerHeight,
      headerH: (() => {
        const h = document.querySelector("header");
        return h ? Math.round(h.getBoundingClientRect().height) : null;
      })(),
      mainRect: (() => {
        const m = document.querySelector("main");
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return { top: Math.round(r.top), h: Math.round(r.height), clientH: m.clientHeight, scrollH: m.scrollHeight, overflowY: getComputedStyle(m).overflowY };
      })(),
      terminalRect: (() => {
        const t = document.querySelector(".spot-terminal--pro");
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { top: Math.round(r.top), h: Math.round(r.height), scrollH: t.scrollHeight, clientH: t.clientHeight };
      })(),
      priceInput: priceInput ? { ...rect(priceInput), id: priceInput.id, fontSize: getComputedStyle(priceInput).fontSize } : null,
      entryVisible: !!document.querySelector("#trade-entry"),
      proTerminal: !!document.querySelector(".term-layout"),
      chartBody: rect(chartBody),
      candleHost: rect(candleHost),
      canvas: rect(chartBody?.querySelector("canvas")),
      chartEmptyText: candleHost ? candleHost.textContent.trim().slice(0, 80) : null,
      bookRows: {
        total: rows.length,
        asks: rows.filter((r) => r.dataset.side === "ask").length,
        bids: rows.filter((r) => r.dataset.side === "bid").length,
        firstRowText: rows[0] ? rows[0].textContent.replace(/\s+/g, " ").trim().slice(0, 80) : null,
      },
      bookBodyText: bookBody ? bookBody.textContent.replace(/\s+/g, " ").trim().slice(0, 120) : null,
      bottomPanel: inViewport(bottom),
      recentTrades: inViewport(rt),
      banner: document.querySelector(".term-banner")?.textContent.replace(/\s+/g, " ").trim().slice(0, 160) ?? null,
      lastPrice: document.querySelector(".term-top")?.textContent.replace(/\s+/g, " ").trim().slice(0, 120) ?? null,
    };
  });

  console.log("=== RENDERED ===");
  console.log(JSON.stringify(render, null, 1));

  console.log("=== API REQUESTS ===");
  for (const row of api) console.log(JSON.stringify(row));
  const envInfo = await page.evaluate(async () => {
    const mod = await import("/src/lib/api.ts").catch(() => null);
    return {
      base: mod ? mod.API_BASE_URL : "import-failed",
      demo: window.localStorage.getItem("btcbox-demo-preview"),
    };
  }).catch((err) => ({ error: String(err).slice(0, 120) }));
  if (envInfo) console.log("=== ENV ===", JSON.stringify(envInfo));
  console.log("=== ALL REQUESTS (" + anyReq.length + ") ===");
  for (const row of anyReq) console.log(row);
  console.log("=== RENDERED ===");
  console.log(JSON.stringify(render, null, 1));

  const diag = await page.evaluate(() => {
    const host = document.querySelector(".term-chart-body .trade-candles");
    if (!host) return null;
    const kids = [...host.children].map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 40),
        w: Math.round(r.width),
        h: Math.round(r.height),
        position: cs.position,
        inlineW: el.style.width || null,
        inlineH: el.style.height || null,
      };
    });
    const cs = getComputedStyle(host);
    return {
      host: {
        w: Math.round(host.getBoundingClientRect().width),
        h: Math.round(host.getBoundingClientRect().height),
        clientW: host.clientWidth,
        clientH: host.clientHeight,
        padding: cs.padding,
        boxSizing: cs.boxSizing,
      },
      children: kids,
    };
  });
  console.log("=== CHART DOM ===");
  console.log(JSON.stringify(diag, null, 1));

  const diag2 = await page.evaluate(() => {
    const host = document.querySelector(".term-chart-body .trade-candles");
    if (!host) return null;
    const walk = (el, depth) => {
      const r = el.getBoundingClientRect();
      return {
        depth,
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") || "").slice(0, 60),
        w: Math.round(r.width),
        h: Math.round(r.height),
        inlineW: el.style.width || null,
        inlineH: el.style.height || null,
        pos: getComputedStyle(el).position,
        children: depth < 4 ? [...el.children].map((c) => walk(c, depth + 1)) : undefined,
      };
    };
    return walk(host, 0);
  });
  console.log("=== CHART TREE ===");
  console.log(JSON.stringify(diag2, null, 1));

  const columns = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
    };
    const main = document.querySelector(".term-col--main");
    const kids = main ? [...main.children].map((el) => {
      const r = el.getBoundingClientRect();
      return { cls: (el.getAttribute("class") || "").slice(0, 40), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
    }) : null;
    return {
      layout: pick(".term-layout"),
      mainCol: pick(".term-col--main"),
      mainChildren: kids,
      bookCol: pick(".term-col--book"),
      bookChildren: (() => {
        const b = document.querySelector(".term-col--book");
        if (!b) return null;
        return [...b.children].map((el) => {
          const r = el.getBoundingClientRect();
          return { cls: (el.getAttribute("class") || "").slice(0, 46), h: Math.round(r.height) };
        });
      })(),
      entryCol: pick(".term-col--entry"),
      chart: pick(".term-chart"),
      bottom: pick(".term-bottom"),
    };
  });
  console.log("=== COLUMNS ===");
  console.log(JSON.stringify(columns, null, 1));

  await page.screenshot({ path: "test-results/live-term-" + width + "x" + height + ".png" });

  // Scroll-to-bottom check: on short viewports the terminal scrolls as a
  // surface, so the orders/history/assets panel must be reachable.
  const afterScroll = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = main.scrollHeight;
    const bottom = document.querySelector(".term-bottom");
    if (!bottom) return null;
    const r = bottom.getBoundingClientRect();
    const tab = bottom.querySelector("[role=tab]");
    return {
      scrollable: main ? main.scrollHeight > main.clientHeight : false,
      scrolledTo: main ? Math.round(main.scrollTop) : null,
      bottomTop: Math.round(r.top),
      bottomBottom: Math.round(r.bottom),
      inViewportAfterScroll: r.bottom <= window.innerHeight + 1,
      tabLabel: tab ? tab.textContent.trim() : null,
    };
  });
  console.log("=== AFTER SCROLL ===");
  console.log(JSON.stringify(afterScroll, null, 1));

  // New interaction checks: sign-in gate, order-book expand, fills tab.
  const ui = await page.evaluate(() => {
    const txt = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    const form = document.querySelector(".term-form");
    const banner = document.querySelector(".term-banner");
    return {
      bannerText: txt(".term-banner"),
      bannerAction: txt(".term-banner-action"),
      bannerHasClose: !!document.querySelector(".term-banner-close"),
      formLocked: form ? form.classList.contains("term-form--locked") : null,
      formCursor: form ? getComputedStyle(form).cursor : null,
      disabledInputs: document.querySelectorAll(".term-form input:disabled").length,
      expandBtn: !!document.querySelector(".term-book-expand"),
      tabs: [...document.querySelectorAll(".term-bottom-tabs [role=tab]")].map((b) => b.textContent.trim()),
      productNav: (() => {
        const nav = document.querySelector(".term-product-nav nav");
        if (!nav) return null;
        const links = [...nav.querySelectorAll("a")].map((a) => ({
          text: a.textContent.replace(/\s+/g, " ").trim(),
          href: a.getAttribute("href"),
          active: a.getAttribute("aria-current") === "page",
        }));
        return { count: links.length, links, height: Math.round(nav.getBoundingClientRect().height) };
      })(),
    };
  });
  console.log("=== UI CHECKS ===");
  console.log(JSON.stringify(ui, null, 1));

  // Clicking the locked form must open the sign-in dialog. Try the visible CTA
  // first (a real user target), then a disabled input in the middle of the form.
  const beforeDialogs = await page.locator("[role=dialog]").count();
  await page.locator(".term-form .term-submit").click();
  await page.waitForTimeout(800);
  const afterCta = await page.locator("[role=dialog]").count();
  const ctaTitle = afterCta ? (await page.locator("[role=dialog]").first().getAttribute("aria-label")) : null;
  console.log("=== SIGN-IN GATE ===", JSON.stringify({ beforeDialogs, afterCta, ctaTitle }));

  if (afterCta) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  await page.locator(".term-form .term-input").first().click({ force: true });
  await page.waitForTimeout(800);
  const afterInput = await page.locator("[role=dialog]").count();
  console.log("=== FORM CLICK ===", JSON.stringify({ afterInput }));

  if (afterInput) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // Order-book expand: the tape must disappear and the ladder must grow.
  const bookBefore = await page.evaluate(() => {
    const body = document.querySelector(".term-book-body");
    return {
      tapeVisible: !!document.querySelector(".term-rt") && getComputedStyle(document.querySelector(".term-rt")).display !== "none",
      bookH: body ? Math.round(body.getBoundingClientRect().height) : null,
    };
  });
  await page.locator(".term-book-expand").click();
  await page.waitForTimeout(500);
  const bookAfter = await page.evaluate(() => {
    const body = document.querySelector(".term-book-body");
    return {
      tapeVisible: !!document.querySelector(".term-rt") && getComputedStyle(document.querySelector(".term-rt")).display !== "none",
      bookH: body ? Math.round(body.getBoundingClientRect().height) : null,
      levels: document.querySelectorAll(".term-book-body .spot-book-row").length,
    };
  });
  console.log("=== BOOK EXPAND ===", JSON.stringify({ bookBefore, bookAfter }));

  // Fills tab: must exist and render its own empty state when signed out.
  await page.locator(".term-bottom-tabs [role=tab]", { hasText: "Trade history" }).click();
  await page.waitForTimeout(400);
  const fills = await page.evaluate(() => {
    const panel = document.querySelector(".term-tab-body");
    return {
      selected: document.querySelector(".term-bottom-tabs [aria-selected=true]")?.textContent?.trim() ?? null,
      bodyText: panel?.textContent?.replace(/\s+/g, " ").trim().slice(0, 90) ?? null,
    };
  });
  console.log("=== FILLS TAB ===", JSON.stringify(fills));

  // Market-outage degradation: `/api/market` fails, so the terminal must show
  // the feed-down strip, must NOT invent a price, and the retry must re-fetch.
  await page.route("**/api/market**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "MARKET_DATA_UNAVAILABLE", msg: "provider down" }) }),
  );
  let marketCalls = 0;
  page.on("request", (req) => { if (new URL(req.url()).pathname === "/api/market") marketCalls += 1; });

  await page.goto(base + "/trade/BTCUSDT", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6500);

  const outage = await page.evaluate(() => {
    const strip = document.querySelector(".term-feeddown");
    const priceEl = document.querySelector(".term-top-price");
    const statValues = [...document.querySelectorAll(".term-top-stats b")].map((b) => b.textContent.trim());
    return {
      stripVisible: !!strip,
      stripText: strip?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      hasRetry: !!document.querySelector(".term-feeddown-retry"),
      topPrice: priceEl?.textContent?.trim() ?? null,
      statValues,
      // A fabricated quote would show digits here; an honest outage shows "—".
      priceIsPlaceholder: priceEl ? !/\d/.test(priceEl.textContent || "") : null,
    };
  });
  console.log("=== MARKET OUTAGE ===", JSON.stringify(outage));

  const callsBeforeRetry = marketCalls;
  await page.locator(".term-feeddown-retry").click();
  await page.waitForTimeout(2500);
  console.log("=== RETRY REFETCH ===", JSON.stringify({ callsBeforeRetry, callsAfterRetry: marketCalls, refetched: marketCalls > callsBeforeRetry }));

  // Product switcher must route to the other trading products. Checked last so
  // the earlier layout measurements still ran on the spot terminal.
  await page.unroute("**/api/market**");
  await page.goto(base + "/trade/BTCUSDT", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const navHrefs = await page.evaluate(() =>
    [...document.querySelectorAll(".term-product-nav nav a")].map((a) => a.getAttribute("href")),
  );
  console.log("=== PRODUCT NAV HREFS ===", JSON.stringify(navHrefs));

  const topbar = await page.evaluate(() => {
    const header = document.querySelector("header.topbar");
    if (!header) return null;
    const q = (sel) => header.querySelector(sel);
    const navLinks = [...header.querySelectorAll("nav a")].map((a) => ({
      text: a.textContent.replace(/\s+/g, " ").trim(),
      href: a.getAttribute("href"),
      active: a.getAttribute("aria-current") === "page",
      // Active tab must carry a green underline / glow.
      indicator: (() => {
        const bar = a.querySelector('span[aria-hidden="true"]');
        if (!bar) return null;
        const cs = getComputedStyle(bar);
        return { opacity: cs.opacity, background: cs.backgroundColor, glow: cs.boxShadow !== "none" };
      })(),
    }));
    const search = q("input[type=search]");
    const searchForm = q("form[role=search]");
    const buttons = [...header.querySelectorAll("button")];
    const signUpBtn = buttons.find((b) => /Sign Up|注册|新規登録|Registr/.test(b.textContent || ""));
    return {
      height: Math.round(header.getBoundingClientRect().height),
      // LEFT: logo then product tabs
      leftOrder: [...header.children]
        .filter((el) => el.getAttribute("aria-hidden") !== "true")
        .map((el) => {
          if (el.tagName === "A" && el.getAttribute("aria-label") === "BTCBOX home") return "logo";
          if (el.tagName === "NAV") return "productTabs";
          if (el.tagName === "FORM") return "search";
          return "actions";
        }),
      logo: !!q('a[aria-label="BTCBOX home"]'),
      navLinks,
      // CENTER: compact search with shortcut hint
      searchVisible: !!search && search.getBoundingClientRect().width > 0,
      searchHeight: search ? Math.round(search.getBoundingClientRect().height) : null,
      shortcutHint: (searchForm?.textContent || "").match(/(⌘K|Ctrl K)/)?.[0] ?? null,
      // RIGHT: Sign In / Sign Up / Support icon / Language
      signIn: buttons.some((b) => /^(Sign in|登录|ログイン)/.test((b.textContent || "").trim())),
      signUp: !!signUpBtn,
      signUpText: signUpBtn?.textContent?.trim() ?? null,
      signUpGradient: signUpBtn ? getComputedStyle(signUpBtn).backgroundImage.includes("gradient") : null,
      supportIconOnly: (() => {
        const el = q('a[aria-label="Support"]');
        if (!el) return null;
        return { hasSvg: !!el.querySelector("svg"), textLength: (el.textContent || "").trim().length };
      })(),
      language: !!header.querySelector('[aria-label*="Language"], [aria-haspopup="listbox"], button[aria-expanded]'),
      // Glass: backdrop blur + translucent background + hairline border
      glass: {
        backdropFilter: getComputedStyle(header).backdropFilter,
        backgroundColor: getComputedStyle(header).backgroundColor,
        borderBottom: getComputedStyle(header).borderBottomWidth,
      },
      singleRow: (() => {
        const centers = [...header.children]
          .filter((el) => el.getAttribute("aria-hidden") !== "true")
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => Math.round(r.top + r.height / 2));
        return { centers, isSingleRow: new Set(centers).size === 1 };
      })(),
    };
  });
  console.log("=== TOPBAR ===", JSON.stringify(topbar, null, 1));

  // Cmd/Ctrl+K must focus the global search box.
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  const shortcut = await page.evaluate(() => {
    const input = document.querySelector("header.topbar input[type=search]");
    return { focused: input === document.activeElement };
  });
  console.log("=== CMD+K ===", JSON.stringify(shortcut));

  // Japanese is the widest label set — the row must still stay single-line.
  await page.evaluate(() => window.localStorage.setItem("btcbox-language", "ja"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const jaBar = await page.evaluate(() => {
    const header = document.querySelector("header.topbar");
    if (!header) return null;
    const children = [...header.children]
      .filter((el) => el.getAttribute("aria-hidden") !== "true")
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    return {
      height: Math.round(header.getBoundingClientRect().height),
      isSingleRow: new Set(children.map((r) => Math.round(r.top + r.height / 2))).size === 1,
      overflowX: header.scrollWidth > header.clientWidth + 1,
      navLabels: [...header.querySelectorAll("nav a")].map((a) => a.textContent.replace(/\s+/g, " ").trim()),
    };
  });
  console.log("=== TOPBAR JA ===", JSON.stringify(jaBar));
  await page.evaluate(() => window.localStorage.setItem("btcbox-language", "en"));

  // Duplicate-chrome audit: the terminal must not repeat the header's product
  // tabs or its sign-in / register actions.
  await page.goto(base + "/trade/BTCUSDT", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const dupes = await page.evaluate(() => {
    const header = document.querySelector("header.topbar");
    const term = document.querySelector(".spot-terminal--pro");
    const termTop = document.querySelector(".term-top-links");
    const countIn = (root, sel) => (root ? root.querySelectorAll(sel).length : 0);
    return {
      headerProductTabs: countIn(header?.querySelector("nav"), "a"),
      terminalProductNav: !!document.querySelector(".term-product-nav"),
      termTopLinks: termTop ? [...termTop.querySelectorAll("a,button")].map((el) => el.textContent.replace(/\s+/g, " ").trim()) : null,
      headerAuthButtons: header ? [...header.querySelectorAll("button")].map((b) => b.textContent.replace(/\s+/g, " ").trim()).filter(Boolean) : null,
      signinCard: (() => {
        const card = document.querySelector(".term-signin-card");
        if (!card) return null;
        return {
          title: card.querySelector(".term-signin-card__title")?.textContent?.trim() ?? null,
          hint: card.querySelector(".term-signin-card__hint")?.textContent?.trim() ?? null,
          hasCta: !!card.querySelector(".term-submit"),
          fullWidthCta: (() => {
            const btn = card.querySelector(".term-submit");
            const form = document.querySelector(".term-form");
            if (!btn || !form) return null;
            return Math.abs(btn.getBoundingClientRect().width - (form.getBoundingClientRect().width - 20)) < 40;
          })(),
        };
      })(),
      terminalTopleft: term ? Math.round(term.getBoundingClientRect().top) : null,
    };
  });
  const orderBook = await page.evaluate(() => {
    const body = document.querySelector(".term-book-body");
    if (!body) return null;
    const rows = [...body.querySelectorAll(".spot-book-row")];
    const asks = rows.filter((r) => r.dataset.side === "ask");
    const bids = rows.filter((r) => r.dataset.side === "bid");
    const mid = body.querySelector(".term-book-mid");
    const visible = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      return r.top >= bodyRect.top - 1 && r.bottom <= bodyRect.bottom + 1;
    };
    return {
      total: rows.length,
      asks: asks.length,
      bids: bids.length,
      // The mid price must sit between asks (above) and bids (below).
      asksAllAboveMid: asks.every((r) => {
        const midR = mid?.getBoundingClientRect();
        return midR ? r.getBoundingClientRect().bottom <= midR.top + 1 : true;
      }),
      bidsAllBelowMid: bids.every((r) => {
        const midR = mid?.getBoundingClientRect();
        return midR ? r.getBoundingClientRect().top >= midR.bottom - 1 : true;
      }),
      firstBidVisible: visible(bids[bids.length - 1]),
      lastAskVisible: visible(asks[0]),
      // Depth bars: rows must carry a non-zero background size.
      depthBarCount: rows.filter((r) => {
        const bg = r.style.backgroundSize;
        return bg && bg !== "0% 100%" && bg !== "0%";
      }).length,
      midPrice: mid?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    };
  });
  console.log("=== ORDER BOOK ===", JSON.stringify(orderBook, null, 1));

  // Font-size audit against the spec's type ramp (24px price / 16px pair / 12px book).
  const sizes = await page.evaluate(() => {
    const px = (sel) => {
      const el = document.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    };
    return {
      spotPrice: px(".term-top-price"),
      spotPair: px(".term-top-pair"),
      bookRow: px(".term-book-body .spot-book-row"),
      bookMid: px(".term-book-mid-price"),
      railPair: px(".term-rail-pair"),
    };
  });
  console.log("=== FONT SIZES ===", JSON.stringify(sizes));

  // Symbol / pair switcher: every trading product needs one, otherwise the
  // user is pinned to whatever pair the URL happened to contain.
  for (const [route, label] of [["/trade/BTCUSDT", "spot"], ["/contract", "perpetual"], ["/seconds", "seconds"]]) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const picker = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) return null;
      const buttons = [...main.querySelectorAll("button,[role=combobox],[role=button]")];
      const candidates = buttons
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map((el) => ({
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
          aria: el.getAttribute("aria-label"),
          expanded: el.getAttribute("aria-expanded"),
          hasChevron: !!el.querySelector("svg"),
        }))
        .filter((b) => /USDT|BTC|ETH/.test(b.text + " " + (b.aria || "")));
      const selects = [...main.querySelectorAll("select")].map((s) => s.getAttribute("aria-label"));
      return { candidates: candidates.slice(0, 6), nativeSelects: selects };
    });
    console.log(`=== SYMBOL PICKER ${label} ===`, JSON.stringify(picker));
  }

  // Does the switcher actually work? Click it and count the options offered.
  await page.goto(base + "/contract", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const perpBtn = page.locator("main button").filter({ hasText: /^[A-Z]+USDT$/ }).first();
  const perpExists = (await perpBtn.count()) > 0;
  if (perpExists) await perpBtn.click({ force: true });
  await page.waitForTimeout(1200);
  const perpOptions = await page.evaluate(() => {
    // Radix portals the dialog to <body>, outside <main>.
    const dlg = document.querySelector('[role="dialog"]');
    const items = dlg ? [...dlg.querySelectorAll("button,[role=option]")].map((b) => (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20)).filter(Boolean) : [];
    return { dialogOpen: !!dlg, optionCount: items.length, sample: items.slice(0, 8) };
  });
  console.log("=== PERP PICKER OPEN ===", JSON.stringify({ perpExists, after: perpOptions }));

  // Verify both pickers are the SAME component (shared class names, same title).
  const sharedPicker = await page.evaluate(() => {
    const probe = (sel) => {
      const el = document.querySelector(sel);
      return el ? { cls: el.className?.toString().slice(0, 50), text: el.textContent?.replace(/\s+/g, " ").trim().slice(0, 40) } : null;
    };
    return {
      spot: probe(".term-pair-dialog"),
      perp: probe(".term-pair-dialog"),
    };
  });
  console.log("=== SHARED PICKER CLASSES ===", JSON.stringify(sharedPicker));

  // Spot pair switcher: open it and confirm the enabled pairs are listed.
  await page.goto(base + "/trade/BTCUSDT", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const spotTrigger = page.locator(".term-top-pair--button").first();
  const spotExists = (await spotTrigger.count()) > 0;
  const spotDisabled = spotExists ? await spotTrigger.isDisabled() : null;
  if (spotExists && !spotDisabled) await spotTrigger.click();
  await page.waitForTimeout(800);
  const spotPicker = await page.evaluate(() => {
    const dlg = document.querySelector(".term-pair-dialog");
    const options = dlg ? [...dlg.querySelectorAll(".term-pair-option")].map((b) => b.textContent.trim()) : [];
    return { open: !!dlg, count: options.length, sample: options.slice(0, 8) };
  });
  console.log("=== SPOT PICKER ===", JSON.stringify({ spotExists, spotDisabled, spotPicker }));

  // Binance-style market rail: always-visible pair list with search.
  const rail = await page.evaluate(() => {
    const aside = document.querySelector(".term-col--pairs");
    if (!aside) return null;
    const rows = [...aside.querySelectorAll(".term-rail-row")];
    return {
      present: true,
      open: aside.getAttribute("data-open"),
      width: Math.round(aside.getBoundingClientRect().width),
      hasSearch: !!aside.querySelector(".term-rail-search input"),
      rowCount: rows.length,
      firstRows: rows.slice(0, 5).map((r) => r.textContent.replace(/\s+/g, " ").trim()),
      activeRow: aside.querySelector(".term-rail-row.is-active")?.textContent.replace(/\s+/g, " ").trim() ?? null,
    };
  });
  console.log("=== MARKET RAIL ===", JSON.stringify(rail));

  // Search filters the rail, and clicking a row switches the pair.
  if (rail?.hasSearch) {
    const railSearch = page.locator(".term-col--pairs .term-rail-search input");
    // `force` because the ticker refresh re-renders the rail every few seconds,
    // which keeps Playwright's stability check from ever settling.
    await railSearch.click({ force: true });
    await railSearch.fill("eth", { force: true });
    await page.waitForTimeout(900);
    const filtered = await page.locator(".term-col--pairs .term-rail-row").count();
    const filteredText = await page.locator(".term-col--pairs .term-rail-row").allTextContents();
    const inputValue = await railSearch.inputValue();
    console.log("=== RAIL SEARCH ===", JSON.stringify({ inputValue, filtered, filteredText }));
    await railSearch.fill("");
    await page.waitForTimeout(400);
    await page.locator(".term-col--pairs .term-rail-row").nth(1).click();
    await page.waitForTimeout(1500);
    console.log("=== RAIL NAV ===", JSON.stringify({ path: new URL(page.url()).pathname }));

    // Collapse toggle: the rail must give its width back to the chart.
    await page.waitForTimeout(800);
    const before = await page.evaluate(() => ({
      rail: Math.round(document.querySelector(".term-col--pairs")?.getBoundingClientRect().width ?? 0),
      chart: Math.round(document.querySelector(".term-chart")?.getBoundingClientRect().width ?? 0),
    }));
    await page.locator(".term-rail-toggle").click({ force: true });
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => ({
      rail: Math.round(document.querySelector(".term-col--pairs")?.getBoundingClientRect().width ?? 0),
      chart: Math.round(document.querySelector(".term-chart")?.getBoundingClientRect().width ?? 0),
      rows: document.querySelectorAll(".term-rail-row").length,
    }));
    console.log("=== RAIL COLLAPSE ===", JSON.stringify({ before, after }));
  }

  // Selecting a pair must navigate to that market.
  if (spotPicker.open && spotPicker.count > 1) {
    await page.locator(".term-pair-option").nth(1).click();
    await page.waitForTimeout(1200);
    console.log("=== SPOT PICKER NAV ===", JSON.stringify({ path: new URL(page.url()).pathname }));
  }

  // If the dialog is not open, report why: disabled state or missing markets.
  if (!perpOptions.dialogOpen && perpExists) {
    const why = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("main button")].find((b) => /^[A-Z]+USDT$/.test((b.textContent || "").trim()));
      return {
        disabled: btn?.disabled ?? null,
        ariaDisabled: btn?.getAttribute("aria-disabled") ?? null,
        text: (btn?.textContent || "").trim(),
        dialogCountAnywhere: document.querySelectorAll('[role="dialog"]').length,
        anyPortal: document.querySelectorAll("body > div[data-radix-portal], body > div[id^='radix']").length,
      };
    });
    console.log("=== PERP PICKER DIAG ===", JSON.stringify(why));
  }

  // Same audit on the other product pages: the header is global, so no page may
  // render its own product switcher or duplicate sign-in/register actions.
  for (const route of ["/contract", "/earn", "/seconds"]) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const pageNav = await page.evaluate(() => {
      const header = document.querySelector("header.topbar");
      const navs = [...document.querySelectorAll("nav")].filter((n) =>
        [...n.querySelectorAll("a")].some((a) => ["/contract", "/seconds", "/earn"].includes(a.getAttribute("href") || "")),
      );
      const main = document.querySelector("main");
      return {
        productNavCount: navs.length,
        insideHeaderOnly: navs.every((n) => header?.contains(n)),
        headerTabs: header ? header.querySelectorAll("nav a").length : 0,
        // Count sign-in / register style actions outside the global header.
        extraAuthActions: main
          ? [...main.querySelectorAll("a,button")].filter((el) => {
            const label = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            return /^(sign in|create account|log in|register|登录|创建账户|ログイン|新規登録)$/.test(label);
          }).length
          : null,
      };
    });
    console.log(`=== PAGE NAV ${route} ===`, JSON.stringify(pageNav));
  }
  for (const [label, expected] of [["Perpetual", "/contract"], ["Seconds", "/seconds"], ["Earn", "/earn"]]) {
    await page.goto(base + "/trade/BTCUSDT", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await page.locator(".term-product-nav nav a", { hasText: label }).click();
    await page.waitForTimeout(900);
    const path = new URL(page.url()).pathname;
    console.log(`=== NAV CLICK ${label} ===`, JSON.stringify({ path, ok: path.startsWith(expected) }));
  }
  await browser.close();
})();
