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
  assert.ok(page.includes('window.setInterval(refreshMarketData,5000)'));
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
  // The poll must be gated on the manual-edit flag before writing the price.
  // Either guard style is acceptable as long as the write is conditional:
  //   if (!isPriceManual && selected.price) setPrice(...)
  //   setPrice(current => current || String(selected.price))
  const guardedWrite = /!isPriceManual[^;]*setPrice\(|setPrice\(current=>current\|\|/.test(refresh);
  assert.ok(guardedWrite, 'the refresh must not write the price unconditionally');
  assert.ok(page.includes('isPriceManual'), 'the manual-price flag must exist');
  // A ref keeps the manual-edit guard current inside the polling callback,
  // avoiding a stale React state closure during five-second market refreshes.
  assert.match(page, /const isPriceManualRef=useRef\(false\)/);
  assert.match(refresh, /!isPriceManualRef\.current\s*&&\s*selected\.price/);
  // Manual order-book selection and direct price edits both activate the guard.
  assert.match(page, /isPriceManualRef\.current=true/);
});

test('spot trading clears stale ticker, order book, and candles when live refresh fails', () => {
  assert.ok(page.includes('marketUpdatedAt'));
  assert.ok(page.includes('marketFeedWarning'));
  const startRefresh = page.indexOf('const refreshMarketData=');
  const endRefresh = page.indexOf('const refreshId=window.setInterval', startRefresh);
  const refresh = page.slice(startRefresh, endRefresh);
  assert.ok(refresh.includes('setTicker(null)'));
  assert.ok(refresh.includes('setMarketUpdatedAt(null)'));
  assert.ok(refresh.includes('setBook(null)'));
  assert.ok(refresh.includes('Market data is temporarily unavailable.'));
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

test('public market overview polls at 5 seconds and prevents overlapping refreshes', () => {
  assert.ok(dashboard.includes('window.setInterval(load, 5000)'));
  assert.ok(dashboard.includes('if (cancelled || refreshing) return;'));
  assert.ok(dashboard.includes('refreshing = true;'));
  assert.ok(dashboard.includes('refreshing = false;'));
  assert.ok(dashboard.includes('window.clearInterval(poll)'));
  assert.ok(dashboard.includes('pending?.abort()'));
  assert.ok(dashboard.includes('cancelled = true;'));
});

test('market table clears last confirmed prices and reports feed unavailability', () => {
  assert.ok(marketTable.includes('const feedError = error || (snapshotStale ?'));
  assert.ok(marketTable.includes('const displayMarkets = feedError ? [] : markets'));
  assert.ok(marketTable.includes('feedError && displayMarkets.length === 0'));
  assert.ok(marketTable.includes('const snapshotStale = snapshotInvalid || markets.some((item) => (') && marketTable.includes('nowSeconds - item.snapshotTs > 90'));
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

test('spot UI keeps market diagnostics and raw trading-rule parameters out of customer-facing markup', () => {
  assert.ok(page.includes('const serverSnapshotTimestampMs=ticker?.snapshotTs?ticker.snapshotTs*1000:null;'));
  for (const label of ['Snapshot checked', 'Provider updated', 'Tick size', 'Quantity step', 'Minimum quantity', 'Minimum notional']) {
    assert.ok(!page.includes('t("' + label + '")'), label + ' must not be rendered in the spot UI');
  }
  assert.ok(!page.includes('displayBook?.source'));
  assert.ok(!page.includes('displayTicker?.source'));
  assert.ok(!page.includes('spot-quote-source'));
  assert.ok(!page.includes('term-snapshot'));
});

const authPage = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/auth/AuthPages.tsx'), 'utf8');

test('sign-in and registration pages expose email, Google and wallet auth', () => {
  assert.ok(authPage.includes('Google'));
  assert.ok(authPage.includes('Wallet'));
  assert.ok(authPage.includes('signInWithGoogle'));
  assert.ok(authPage.includes('Connect Ethereum wallet'));
  assert.ok(authPage.includes('Connect Solana wallet'));
  assert.ok(authPage.includes('signInWithWeb3'));
  assert.ok(authPage.includes('Username or email'));
  assert.ok(authPage.includes('signInWithEmail'));
  assert.ok(authPage.includes('signUpWithEmail'));
  assert.ok(authPage.includes('signInWithGoogle'));
  assert.ok(authPage.includes('signInWithWeb3'));
  assert.ok(authPage.includes('Create account with email'));

  assert.ok(authPage.includes('requestPasswordReset'));
  assert.ok(authPage.includes('completePasswordRecovery'));
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
  const requestIdStart = withdrawPage.indexOf('requestId=window.crypto.randomUUID()');
  const requestIdFailure = withdrawPage.indexOf('catch{setError(t("Account data is temporarily unavailable."));submitLockRef.current=false;return;}', requestIdStart);
  assert.ok(requestIdStart >= 0 && requestIdFailure > requestIdStart, 'missing secure request IDs must stop before sending');
  assert.ok(withdrawPage.includes('finally{submitLockRef.current=false;setSubmitting(false);}'));
});

test('withdrawal retry preserves its idempotency key and saved intent before sending', () => {
  const persist = withdrawPage.indexOf('window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent))');
  const send = withdrawPage.indexOf('submitWithdrawal({');
  assert.ok(persist >= 0 && send > persist);
  assert.ok(withdrawPage.includes('request_id:intent.request_id'));
  assert.ok(withdrawPage.includes('Withdrawal result is unconfirmed. Keep the same request ID and check withdrawal history before retrying.'));
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
  assert.ok(deposit.includes('if(!navigator.clipboard?.writeText)throw new Error(t("Unable to copy. Please try again."))'));
  assert.ok(deposit.includes('setCopyMessage("Deposit address copied.")'));
  assert.ok(deposit.includes('setCopyMessage(t("Unable to copy. Please try again."))'));
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

test('active account and order pages clear stale snapshots before reload and after failures', () => {
  const assets = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/assets/AssetsPage.tsx'), 'utf8');
  const orders = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/orders/OrdersPage.tsx'), 'utf8');
  assert.ok(assets.includes('setAccount(null)'));
  assert.ok(assets.indexOf('setAccount(null)') < assets.indexOf('getAccount(controller.signal)'));
  assert.ok(orders.includes('setOrders([])'));
  assert.ok(orders.indexOf('setOrders([])') < orders.indexOf('getOrders(controller.signal)'));
  assert.ok(orders.includes('if (controller.signal.aborted || requestId !== requestIdRef.current) return;'));
  assert.ok(orders.includes('setOrders([]);'));
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

  // The support conversation lives in SupportChat; the page component only
  // composes it, so the stale-record contract is checked against that module.
  const support = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/support/SupportChat.tsx'), 'utf8');
  assert.ok(support.includes('setLoading(true);'));
  assert.ok(support.includes('setMessages([]);'));
  assert.ok(support.includes('setMessagesAccountKey("")'));
  assert.ok(support.includes('pendingStorageKey'));
  assert.ok(support.includes('currentAccountKeyRef.current !== requestAccountKey'));
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


test('admin user search updates results without clearing the selected user or reloading the tab', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  const users = admin.slice(admin.indexOf('if (tab === "users")'), admin.indexOf('if (tab === "deposits")'));
  assert.ok(users.indexOf('setUsers([])') >= 0);
  assert.ok(users.indexOf('setSelectedUser(null)') > users.indexOf('setUsers([])'));
  assert.ok(users.includes('await getAdminUsers(token, "")'));
  const search = admin.slice(admin.indexOf('const searchUsers = async'), admin.indexOf('const submitBalanceAdjustment'));
  assert.ok(search.includes('getAdminUsers(token, normalizedQuery)'));
  assert.ok(!search.includes('loadTab()'));
  assert.ok(!search.includes('setSelectedUser(null)'));
});


test('admin KYC manual refresh is protected against duplicate in-flight requests', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(admin.includes('const kycRefreshLockRef = useRef(false);'));
  const refresh = admin.slice(admin.indexOf('const refreshKycQueue = async'), admin.indexOf('// A 409 WITHDRAWAL_ALREADY_PROCESSED'));
  assert.ok(refresh.includes('if (!token || kycRefreshLockRef.current) return;'));
  assert.ok(refresh.indexOf('kycRefreshLockRef.current = true;') < refresh.indexOf('await getAdminKyc(token)'));
  assert.ok(refresh.includes('kycRefreshLockRef.current = false;'));
});


test('admin withdrawal queue ignores out-of-order refresh responses', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(admin.includes('const withdrawalQueueRequestRef = useRef(0);'));
  const start = admin.indexOf('const refreshWithdrawalQueue = async');
  const end = admin.indexOf('const loadOlderAuditRecords', start);
  const refresh = admin.slice(start, end);
  assert.equal((refresh.match(/const requestId = \+\+withdrawalQueueRequestRef.current;/g) || []).length, 2);
  assert.equal((refresh.match(/requestId !== withdrawalQueueRequestRef.current/g) || []).length, 4);
  assert.equal((refresh.match(/requestId === withdrawalQueueRequestRef.current/g) || []).length, 2);
});


test('admin KYC refresh responses cannot overwrite a newer post-review queue snapshot', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(admin.includes('const kycQueueRequestRef = useRef(0);'));
  const refreshStart = admin.indexOf('const refreshKycQueue = async');
  const refreshEnd = admin.indexOf('const refreshKycQueueAfterReview = async', refreshStart);
  const refresh = admin.slice(refreshStart, refreshEnd);
  assert.ok(refresh.includes('const requestId = ++kycQueueRequestRef.current;'));
  assert.ok(refresh.includes('if (requestId !== kycQueueRequestRef.current) return;'));
  assert.ok(admin.includes('const refreshKycQueueAfterReview = async (successMessage: string)'));
  assert.ok(admin.includes('await refreshKycQueueAfterReview("KYC approved.");'));
  assert.ok(admin.includes('await refreshKycQueueAfterReview("KYC rejected.");'));
});

test('admin initial KYC and withdrawal tab loads cannot overwrite a newer queue refresh', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  const loadStart = admin.indexOf('const loadTab = useCallback');
  const loadEnd = admin.indexOf('useEffect(() => {\n    void loadTab();', loadStart);
  assert.ok(loadStart >= 0 && loadEnd > loadStart);
  const load = admin.slice(loadStart, loadEnd);
  for (const [tab, ref, getter] of [
    ['withdrawals', 'withdrawalQueueRequestRef', 'getAdminWithdrawals'],
    ['kyc', 'kycQueueRequestRef', 'getAdminKyc'],
  ]) {
    const start = load.indexOf('if (tab === "' + tab + '")');
    const end = load.indexOf('if (tab === "', start + 1);
    const branch = load.slice(start, end > start ? end : load.length);
    assert.ok(branch.includes('const queueRequestId = ++' + ref + '.current;'));
    assert.ok(branch.includes('queueRequestId !== ' + ref + '.current'));
    assert.ok(branch.includes('await ' + getter + '(token)'));
  }
});

test('admin support queue ignores stale initial loads and duplicate replies per customer', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(admin.includes('const supportQueueRequestRef = useRef(0);'));
  assert.ok(admin.includes('const supportReplyLocksRef = useRef<Record<string, boolean>>({});'));
  const loadStart = admin.indexOf('const loadTab = useCallback');
  const loadEnd = admin.indexOf('useEffect(() => {\n    void loadTab();', loadStart);
  const load = admin.slice(loadStart, loadEnd);
  const supportStart = load.indexOf('if (tab === "support")');
  const supportEnd = load.indexOf('if (tab === "seconds")', supportStart);
  const supportLoad = load.slice(supportStart, supportEnd);
  assert.ok(supportLoad.includes('const queueRequestId = ++supportQueueRequestRef.current;'));
  assert.ok(supportLoad.includes('queueRequestId !== supportQueueRequestRef.current'));
  const replyStart = admin.indexOf('const replySupport = async');
  const replyEnd = admin.indexOf('const saveSpotMarket', replyStart);
  const reply = admin.slice(replyStart, replyEnd);
  assert.ok(reply.includes('supportReplyLocksRef.current[uid]'));
  assert.ok(reply.includes('const queueRequestId = ++supportQueueRequestRef.current;'));
  assert.ok(reply.includes('await getAdminSupportMessages(token)'));
  assert.ok(reply.includes('window.crypto.randomUUID()'));
});


test('admin manual-credit completion does not replace a newer selected user', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  const start = admin.indexOf('const manualCredit = async');
  const end = admin.indexOf('const refreshWithdrawalQueue =', start);
  const flow = admin.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(flow.includes('const selectedUid = selectedUser.uid;'));
  assert.ok(flow.includes('const selectedUserRequestId = userDetailRequestRef.current;'));
  assert.ok(flow.includes('userDetailRequestRef.current === selectedUserRequestId && selectedUser?.uid === selectedUid'));
  assert.ok(flow.includes('await selectUser(selectedUid);'));
});


test('admin candidate searches ignore out-of-order responses and tab-load results', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(admin.includes('const adminCandidatesRequestRef = useRef(0);'));
  assert.ok(admin.includes('const candidatesRequestId = ++adminCandidatesRequestRef.current;'));
  assert.ok(admin.includes('if (candidatesRequestId === adminCandidatesRequestRef.current) setAdminCandidates(userResult.users || []);'));
  assert.ok(admin.includes('const requestId=++adminCandidatesRequestRef.current;setAdminCandidates([]);setError("");'));
  assert.ok(admin.includes('if(requestId===adminCandidatesRequestRef.current)setAdminCandidates(result.users||[]);'));
});


test('admin Seconds queue ignores stale initial and manual refresh responses', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(admin.includes('const secondsQueueRequestRef = useRef(0);'));
  assert.ok(admin.includes('if (tab !== "seconds") secondsQueueRequestRef.current += 1;'));
  assert.ok(admin.includes('secondsQueueRequestId !== secondsQueueRequestRef.current'));
  assert.ok(admin.includes('const requestId = ++secondsQueueRequestRef.current; setSecondsQueueLoading(true); setSecondsOpenPositions([]); setSecondsOpenSummary(null);'));
  assert.ok(admin.includes('if (requestId !== secondsQueueRequestRef.current) return; setSecondsOpenPositions(result.positions);'));
  assert.ok(admin.includes('if (requestId === secondsQueueRequestRef.current) setSecondsQueueLoading(false);'));
});


test('admin user profile groups only that UID’s bank details, crypto addresses and support conversation', () => {
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  const selectStart = admin.indexOf('const selectUser = async');
  const selectEnd = admin.indexOf('// Re-read the selected user', selectStart);
  const select = admin.slice(selectStart, selectEnd);
  assert.ok(select.includes('hasPermission("payout_addresses.read_sensitive")'));
  assert.ok(select.includes('hasPermission("support.read")'));
  assert.ok(select.includes('.filter(item => item.uid === uid)'));
  assert.ok(select.includes('String(message.uid || message.user_id || "") === uid'));
  assert.ok(admin.includes("This user's saved addresses and bank cards"));
  assert.ok(admin.includes("This user's customer service conversation"));
  assert.ok(admin.includes('onClick={() => void replySupport(selectedUser.uid)}'));
  assert.ok(admin.includes('onClick={() => void markSupportThreadRead(selectedUser!.uid)}'));
});
