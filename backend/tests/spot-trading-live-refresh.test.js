'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pages = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/pages/Pages.tsx'), 'utf8');
const start = pages.indexOf('export function SpotTradingPage()');
const end = pages.indexOf('export function ', start + 30);
const page = pages.slice(start, end > start ? end : undefined);

test('spot trading page refreshes public ticker and order book without reloading order-entry state', () => {
  assert.ok(start >= 0 && page.length > 0);
  assert.ok(page.includes('window.setInterval(refreshMarketData,15000)'));
  assert.ok(page.includes('getMarkets(controller.signal)'));
  assert.ok(page.includes('getOrderBook(symbol,controller.signal)'));
  assert.ok(page.includes('setTicker(selected)'));
  assert.ok(page.includes('setBook(bookResult.value)'));
  assert.ok(page.includes('window.clearInterval(refreshId)'));
  assert.ok(page.includes('controller.abort()'));
  assert.ok(page.includes('},[symbol]);'));
});

test('spot trading live refresh never overwrites the customer-edited limit price', () => {
  const startRefresh = page.indexOf('const refreshMarketData=');
  const endRefresh = page.indexOf('const refreshId=window.setInterval', startRefresh);
  assert.ok(startRefresh >= 0 && endRefresh > startRefresh);
  const refresh = page.slice(startRefresh, endRefresh);
  assert.ok(!refresh.includes('setPrice('));
  assert.ok(page.includes('setPrice(current=>current||String(selected.price))'));
});

test('spot trading clears stale ticker, order book, and candles when live refresh fails', () => {
  assert.ok(page.includes('marketUpdatedAt'));
  assert.ok(page.includes('Snapshot checked'));
  assert.ok(page.includes('marketFeedWarning'));
  const startRefresh = page.indexOf('const refreshMarketData=');
  const endRefresh = page.indexOf('const refreshId=window.setInterval', startRefresh);
  const refresh = page.slice(startRefresh, endRefresh);
  assert.ok(refresh.includes('setTicker(null)'));
  assert.ok(refresh.includes('setMarketUpdatedAt(null)'));
  assert.ok(refresh.includes('setBook(null)'));
  assert.ok(refresh.includes('Live market data is temporarily unavailable.'));
  assert.ok(page.includes('setCandles([])'));
  assert.ok(!page.includes('showing the last confirmed data'));
});

test('switching spot pairs clears the previous pair snapshot and edited limit price', () => {
  const initialLoad = page.slice(page.indexOf('useEffect(()=>{'), page.indexOf('},[symbol,reload])'));
  assert.ok(initialLoad.includes('setTicker(null)'));
  assert.ok(initialLoad.includes('setCandles([])'));
  assert.ok(initialLoad.includes('setBook(null)'));
  assert.ok(initialLoad.includes('setPrice("")'));
});

const app = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/App.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/dashboard/Dashboard.tsx'), 'utf8');
const marketTable = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/dashboard/components/LiveMarketsTable.tsx'), 'utf8');

test('spot market preview route is public while account and order APIs remain separately gated', () => {
  assert.ok(app.includes('<Route path="/trade/:symbol" element={<SpotTradingPage />} />'));
  assert.ok(!app.includes('<Route path="/trade/:symbol" element={<ProtectedAccountRoute>'));
  assert.ok(page.includes('accountResult.reason.code==="AUTH_REQUIRED"'));
  assert.ok(page.includes('getOrders(controller.signal)'));
});

test('public market overview polls at 15 seconds and prevents overlapping refreshes', () => {
  assert.ok(dashboard.includes('window.setInterval(loadMarkets, 15000)'));
  assert.ok(dashboard.includes('if (refreshing || controller.signal.aborted) return;'));
  assert.ok(dashboard.includes('refreshing = true;'));
  assert.ok(dashboard.includes('refreshing = false;'));
});

test('market table clears last confirmed prices and reports feed unavailability', () => {
  assert.ok(marketTable.includes('const displayMarkets = error ? [] : markets'));
  assert.ok(marketTable.includes('error && displayMarkets.length === 0'));
  assert.ok(!marketTable.includes('Showing the last confirmed market data.'));
  assert.ok(dashboard.includes('setMarkets([]);'));
});
const api = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/lib/api.ts'), 'utf8');
const backend = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');

test('market API carries per-symbol server snapshot time separately from provider event time', () => {
  assert.ok(backend.includes('const snapshotTs = Math.floor(Date.now() / 1000)'));
  assert.ok(backend.includes('ts: snapshotTs, providerTs: marketsByBase[row.sym].providerTs, source: row.source'));
  assert.ok(backend.includes("products/' + productId + '/ticker'"));
  assert.ok(backend.includes('Date.parse(ticker.time)'));
  assert.ok(backend.includes('Math.floor(providerTimeMs / 1000)'));
  assert.ok(api.includes('providerTs?: number'));
  assert.ok(api.includes('snapshotTs?: number'));
  assert.ok(api.includes('snapshotTs: Number.isFinite(snapshot?.ts)'));
});

test('spot UI labels server snapshot time and does not substitute browser receipt time', () => {
  assert.ok(page.includes('t("Snapshot checked")'));
  assert.ok(page.includes('selected.snapshotTs?selected.snapshotTs*1000:null'));
  assert.ok(!page.includes('setMarketUpdatedAt(Date.now())'));
});

const authPage = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/auth/AuthPages.tsx'), 'utf8');

test('sign-in and registration pages expose username, Google and Web3 without email auth', () => {
  assert.ok(authPage.includes('Continue with Google'));
  assert.ok(authPage.includes('signInWithGoogle'));
  assert.ok(authPage.includes('Connect Ethereum wallet'));
  assert.ok(authPage.includes('Connect Solana wallet'));
  assert.ok(authPage.includes('signInWithWeb3'));
  assert.ok(authPage.includes('Sign in with username'));
  assert.ok(!authPage.includes('Continue with email'));
  assert.ok(!authPage.includes('Register with email'));
});

const withdrawStart = pages.indexOf('export function WithdrawPage()');
const withdrawEnd = pages.indexOf('export function ', withdrawStart + 30);
const withdrawPage = pages.slice(withdrawStart, withdrawEnd > withdrawStart ? withdrawEnd : undefined);

test('withdrawal submit handler synchronously blocks concurrent duplicate browser submissions', () => {
  assert.ok(withdrawStart >= 0 && withdrawPage.length > 0);
  assert.ok(withdrawPage.includes('const submitLockRef=useRef(false)'));
  assert.ok(withdrawPage.includes('submitLockRef.current)return'));
  assert.ok(withdrawPage.includes('submitLockRef.current=true'));
  assert.ok(withdrawPage.includes('window.crypto.randomUUID()'));
  assert.ok(withdrawPage.includes('Secure withdrawal request IDs are unavailable in this browser.'));
  assert.ok(withdrawPage.includes('finally{submitLockRef.current=false;setSubmitting(false);}'));
});

test('withdrawal retry preserves its idempotency key and saved intent before sending', () => {
  const persist = withdrawPage.indexOf('window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent))');
  const send = withdrawPage.indexOf('submitWithdrawal({');
  assert.ok(persist >= 0 && send > persist);
  assert.ok(withdrawPage.includes('request_id:intent.request_id'));
  assert.ok(withdrawPage.includes('Keep this request unchanged and retry with the same request ID.'));
});

test('My account page clears stale profile data when its authenticated refresh fails', () => {
  const myStart = pages.indexOf('export function MyPage()');
  const myEnd = pages.indexOf('export function ', myStart + 25);
  const myPage = pages.slice(myStart, myEnd > myStart ? myEnd : undefined);
  assert.ok(myStart >= 0);
  assert.ok(myPage.includes('if(!controller.signal.aborted){'));
  assert.ok(myPage.includes('setAccount(null);'));
  assert.ok(myPage.includes('Account profile is temporarily unavailable.'));
});

const adminPage = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('admin withdrawal review hides stale actionable queue data when refresh fails', () => {
  const refreshStart = adminPage.indexOf('const refreshWithdrawalQueue =');
  const refreshEnd = adminPage.indexOf('const loadOlderAuditRecords', refreshStart);
  const refresh = adminPage.slice(refreshStart, refreshEnd);
  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart);
  assert.equal((refresh.match(/setWithdrawals\(\[\]\)/g) || []).length, 4);
  assert.ok(refresh.includes('The queue could not refresh. Reload this tab before taking another action.'));
});

test('deposit destination is cleared immediately when asset or network changes', () => {
  const start = pages.indexOf('export function DepositPage()');
  const end = pages.indexOf('export function ', start + 30);
  const deposit = pages.slice(start, end > start ? end : undefined);
  assert.ok(start >= 0 && deposit.length > 0);
  assert.ok(deposit.includes('const changeCoin=(next:string)=>{setAddress("");setError("");setCopyMessage("");'));
  assert.ok(deposit.includes('const changeNetwork=(next:string)=>{setAddress("");setError("");setCopyMessage("");'));
  assert.ok(deposit.includes('onChange={e=>changeNetwork(e.target.value)}'));
});

test('deposit address copy reports clipboard success and failure without silent no-op', () => {
  const start = pages.indexOf('export function DepositPage()');
  const end = pages.indexOf('export function ', start + 30);
  const deposit = pages.slice(start, end > start ? end : undefined);
  assert.ok(deposit.includes('if(!navigator.clipboard?.writeText)throw new Error("Clipboard access is unavailable.")'));
  assert.ok(deposit.includes('setCopyMessage("Deposit address copied.")'));
  assert.ok(deposit.includes('setCopyMessage("Could not copy the address. Select and copy it manually.")'));
  assert.ok(deposit.includes('onClick={copyAddress}'));
});

test('asset and order snapshots are cleared before a refresh can return stale account data', () => {
  const assets = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/assets/AssetsPage.tsx'), 'utf8');
  const orders = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/orders/OrdersPage.tsx'), 'utf8');
  const assetLoad = assets.slice(assets.indexOf('async function load'), assets.indexOf('useEffect', assets.indexOf('async function load')));
  const orderLoad = orders.slice(orders.indexOf('async function load'), orders.indexOf('useEffect', orders.indexOf('async function load')));
  assert.ok(assetLoad.indexOf('setAccount(null)') >= 0 && assetLoad.indexOf('setAccount(null)') < assetLoad.indexOf('await getAccount'));
  assert.ok(orderLoad.indexOf('setOrders([])') >= 0 && orderLoad.indexOf('setOrders([])') < orderLoad.indexOf('await getOrders'));
});

test('deposit history is hidden while a new authenticated account snapshot is loading', () => {
  const start = pages.indexOf('export function DepositPage()');
  const end = pages.indexOf('export function ', start + 30);
  const deposit = pages.slice(start, end > start ? end : undefined);
  assert.ok(deposit.indexOf('setDepositHistory([])') >= 0);
  assert.ok(deposit.indexOf('setDepositHistory([])') < deposit.indexOf('getAccount(controller.signal)'));
});

test('admin withdrawal queue is non-actionable until a refreshed queue has returned', () => {
  const refreshStart = adminPage.indexOf('const refreshWithdrawalQueue =');
  const manualStart = adminPage.indexOf('const refreshWithdrawalQueueManually', refreshStart);
  const refreshEnd = adminPage.indexOf('const loadOlderAuditRecords', manualStart);
  const refresh = adminPage.slice(refreshStart, refreshEnd);
  assert.ok(refreshStart >= 0 && manualStart > refreshStart && refreshEnd > manualStart);
  assert.equal((refresh.match(/setWithdrawals\(\[\]\)/g) || []).length, 4);
  assert.ok(adminPage.includes('disabled={busy||reviewQueueLoading||!hasPermission("withdrawals.review")}'));
  assert.ok(adminPage.includes('disabled={busy||reviewQueueLoading||!payoutReferences[item.id]?.trim()||!hasPermission("withdrawals.review")}'));
  assert.ok(adminPage.includes('<input disabled={reviewQueueLoading} value={payoutReferences[item.id]||""}'));
});

test('legacy account profile and order views clear stale snapshots before reload and after failures', () => {
  const myStart = pages.indexOf('export function MyPage()');
  const myEnd = pages.indexOf('export function ', myStart + 25);
  const myPage = pages.slice(myStart, myEnd > myStart ? myEnd : undefined);
  const profileLoad = myPage.slice(myPage.indexOf('const controller=new AbortController()'));
  assert.ok(profileLoad.indexOf('setAccount(null)') >= 0);
  assert.ok(profileLoad.indexOf('setAccount(null)') < profileLoad.indexOf('getAccount(controller.signal)'));

  const ordersStart = pages.indexOf('export function OrdersPage()');
  const ordersEnd = pages.indexOf('export function ', ordersStart + 25);
  const legacyOrders = pages.slice(ordersStart, ordersEnd > ordersStart ? ordersEnd : undefined);
  assert.ok(legacyOrders.indexOf('setOrders([])') >= 0);
  assert.ok(legacyOrders.indexOf('setOrders([])') < legacyOrders.indexOf('getOrders(controller.signal)'));
  assert.ok(legacyOrders.includes('if(!controller.signal.aborted)setOrders([]);'));
});

test('withdrawal, KYC and support views clear stale private records before account refresh', () => {
  const withdrawStart = pages.indexOf('export function WithdrawPage()');
  const withdrawEnd = pages.indexOf('export function ', withdrawStart + 25);
  const withdraw = pages.slice(withdrawStart, withdrawEnd > withdrawStart ? withdrawEnd : undefined);
  const withdrawLoad = withdraw.slice(withdraw.indexOf('const controller=new AbortController()'));
  assert.ok(withdrawLoad.indexOf('setAccount(null)') >= 0);
  assert.ok(withdrawLoad.indexOf('setAddresses([])') >= 0);
  assert.ok(withdrawLoad.indexOf('setConfig(null)') >= 0);
  assert.ok(withdrawLoad.indexOf('setAccount(null)') < withdrawLoad.indexOf('Promise.all('));

  const kycStart = pages.indexOf('export function KycPage()');
  const kycEnd = pages.indexOf('export function ', kycStart + 25);
  const kyc = pages.slice(kycStart, kycEnd > kycStart ? kycEnd : undefined);
  assert.ok(kyc.includes('setAccount(null);setError('));
  assert.ok(kyc.includes('if(!controller.signal.aborted){setAccount(null);setError('));

  const supportStart = pages.indexOf('export function SupportPage()');
  const supportEnd = pages.indexOf('export function ', supportStart + 25);
  const support = pages.slice(supportStart, supportEnd > supportStart ? supportEnd : undefined);
  assert.ok(support.includes('setLoading(true);setMessages([]);setError("")'));
  assert.ok(support.includes('if(!controller.signal.aborted){setMessages([]);setError('));
});


test('admin read tabs clear stale operational snapshots before refresh', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  const expected = [
    ['if (tab === "users")', 'setUsers([]);'],
    ['if (tab === "deposits")', 'setConfig({ deposit_addresses: {},'],
    ['if (tab === "markets")', 'setSpotMarkets([]);'],
    ['if (tab === "orders")', 'setOrders([]);'],
    ['if (tab === "support")', 'setSupport([]);'],
    ['if (tab === "seconds")', 'setSecondsOpenPositions([]);'],
    ['if (tab === "admins" && session.is_super_admin)', 'setAdminMemberships([]);'],
  ];
  for (const [branch, clear] of expected) {
    const start = admin.indexOf(branch);
    assert.ok(start >= 0, branch + ' branch exists');
    assert.ok(admin.indexOf(clear, start) > start, branch + ' clears its previous snapshot before loading');
  }
  const seconds = admin.slice(admin.indexOf('if (tab === "seconds")'), admin.indexOf('if (tab === "admins"'));
  assert.ok(seconds.includes('setSecondsOpenSummary(null);'));
  assert.ok(seconds.includes('setSecondsOpenPositions([]);'));
});

test('admin deposit configuration never substitutes example withdrawal fees for unreadable live config', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  const configInit = admin.slice(admin.indexOf('const [config, setConfig]'), admin.indexOf('const [kyc, setKyc]'));
  assert.ok(configInit.includes('withdrawal_fees: {}'));
  assert.ok(!configInit.includes('USDT: "1"'));
  const depositLoad = admin.slice(admin.indexOf('if (tab === "deposits")'), admin.indexOf('if (tab === "markets")'));
  assert.ok(depositLoad.includes('setConfig({ deposit_addresses: {}, withdrawal_fees: {}, announcement: "" });'));
  assert.ok(!depositLoad.includes('USDT: "1"'));
});

test('admin overview does not retain an old dashboard snapshot during a failed refresh', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  const overview = admin.slice(admin.indexOf('if (tab === "overview")'), admin.indexOf('if (tab === "users")'));
  assert.ok(overview.indexOf('setStats(null)') >= 0);
  assert.ok(overview.indexOf('setStats(null)') < overview.indexOf('await getAdminStats(token)'));
});


test('admin user search refresh clears the previous selected user before loading', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  const users = admin.slice(admin.indexOf('if (tab === "users")'), admin.indexOf('if (tab === "deposits")'));
  assert.ok(users.indexOf('setUsers([])') >= 0);
  assert.ok(users.indexOf('setSelectedUser(null)') > users.indexOf('setUsers([])'));
  assert.ok(users.indexOf('setSelectedUser(null)') < users.indexOf('await getAdminUsers(token, search)'));
});
