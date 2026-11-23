'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/lib/trading.tsx'), 'utf8');

test('paper ledger never loads or creates balances in production builds', () => {
  assert.match(source, /import \{ DEMO_PREVIEW_ACTIVE \} from "\.\/demoPreview"/);
  assert.match(source, /const PAPER_TRADING_ENABLED = import\.meta\.env\.DEV && DEMO_PREVIEW_ACTIVE/);
  assert.match(source, /useState<PaperLedger>\(\(\) => PAPER_TRADING_ENABLED \? loadLedger\(\) : emptyLedger\(\)\)/);
  assert.match(source, /if \(PAPER_TRADING_ENABLED && status === "authenticated"\) initializeDemoWallet\(\)/);
  assert.equal((source.match(/if \(!PAPER_TRADING_ENABLED\)/g) || []).length, 9);
});

test('the local paper-wallet seed is only reachable behind the development guard', () => {
  assert.match(source, /const DEMO_INITIAL_USDT = 10000/);
  const initializer = source.slice(source.indexOf('export function TradingInitializer()'));
  assert.match(initializer, /PAPER_TRADING_ENABLED && status === "authenticated"/);
  assert.match(source, /if \(!PAPER_TRADING_ENABLED\) return;[\s\S]*?commit\(initialLedger\(\)\)/);
});
