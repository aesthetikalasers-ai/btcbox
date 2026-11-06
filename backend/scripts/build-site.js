'use strict';

// Build an allowlisted public directory. Source code, SQL migrations, tests,
// environment templates, and operational documentation stay in GitHub only.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const frontendDist = path.resolve(root, '..', 'frontend', 'dist');
const frontendIndex = path.join(frontendDist, 'index.html');
const frontendAssets = path.join(frontendDist, 'frontend-assets');
const allowedFiles = ['index.html'];
const allowedDirs = ['pages', 'assets', 'oauth'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of allowedFiles) {
  const src = path.join(root, name);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
    throw new Error(`Required public entry file missing: ${name}`);
  }
  fs.copyFileSync(src, path.join(out, name));
}

// The React SPA is the only customer/admin application entry. OAuth callbacks are redirected to its React callback route.
for (const name of allowedDirs) {
  const src = path.join(root, name);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error(`Required public directory missing: ${name}`);
  }
  fs.cpSync(src, path.join(out, name), { recursive: true });
}

// Preserve legacy OAuth and content pages; the administrator console is served by the React SPA.
const pagesDir = path.join(root, 'pages');
for (const entry of fs.readdirSync(pagesDir)) {
  if (entry.endsWith('.html')) {
    fs.copyFileSync(path.join(pagesDir, entry), path.join(out, entry));
  }
}

// Overlay the Strata Pro Vite application as the customer-facing root.
// Vite assets use /frontend-assets so they cannot overwrite legacy /assets.
if (!fs.existsSync(frontendIndex) || !fs.statSync(frontendIndex).isFile()) {
  throw new Error('Vite frontend build is missing: frontend/dist/index.html');
}
if (!fs.existsSync(frontendAssets) || !fs.statSync(frontendAssets).isDirectory()) {
  throw new Error('Vite frontend assets are missing: frontend/dist/frontend-assets');
}
const html = fs.readFileSync(frontendIndex, 'utf8');
if (!html.includes('/frontend-assets/')) {
  throw new Error('Vite index.html does not reference the isolated frontend-assets directory');
}
fs.copyFileSync(frontendIndex, path.join(out, 'index.html'));
fs.cpSync(frontendAssets, path.join(out, 'frontend-assets'), { recursive: true });

console.log('BTCBOX unified public build created in dist/ (React customer/admin app + retained OAuth consent assets).');
