#!/usr/bin/env node
'use strict';
// Long-running supervisor for BTCBOX perpetual workers.
// Deploy only as a dedicated, always-on container (never as a Vercel Function).
// Every task is one-pass and non-overlapping. Failures are surfaced to container
// stderr/logging; a later tick retries without bypassing database fail-closed guards.
const { spawn } = require('node:child_process');
const path = require('node:path');

const SCHEDULES = Object.freeze([
  { name: 'mark-price', file: 'perp-mark-price-worker.js', intervalMs: 60000 },
  { name: 'funding-rate', file: 'perp-funding-rate-worker.js', intervalMs: 15000 },
  { name: 'funding-settlement', file: 'perp-funding-worker.js', intervalMs: 5000 },
  { name: 'liquidation', file: 'perp-liquidation-worker.js', intervalMs: 1000 }
]);

function startSupervisor(options = {}) {
  const spawnChild = options.spawn || spawn;
  const baseDir = options.baseDir || __dirname;
  const timers = [];
  const running = new Set();
  const launch = job => {
    if (running.has(job.name)) return;
    running.add(job.name);
    const child = spawnChild(process.execPath, [path.join(baseDir, job.file)], {
      env: process.env, stdio: ['ignore', 'inherit', 'inherit']
    });
    child.once('error', error => {
      running.delete(job.name);
      console.error('[perp-supervisor] spawn failed', job.name, error.message);
    });
    child.once('exit', (code, signal) => {
      running.delete(job.name);
      if (code !== 0) console.error('[perp-supervisor] worker failed', job.name,
        'code=' + code, 'signal=' + signal + '; next scheduled pass will retry.');
    });
  };
  for (const job of SCHEDULES) {
    launch(job);
    timers.push(setInterval(() => launch(job), job.intervalMs));
  }
  return () => {
    for (const timer of timers) clearInterval(timer);
  };
}

if (require.main === module) {
  if (!process.env.SUPABASE_URL ||
      !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)) {
    console.error('[perp-supervisor] missing Supabase service credentials');
    process.exit(1);
  }
  console.log('[perp-supervisor] starting dedicated perpetual worker process');
  startSupervisor();
}

module.exports = { SCHEDULES, startSupervisor };
