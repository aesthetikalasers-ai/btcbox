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
const allowedFiles = ['index.html', 'admin.html'];
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

// Keep the original BTCBOX SPA available for the existing OAuth callback
// while the new React frontend's Supabase callback flow is being integrated.
fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'legacy-index.html'));

for (const name of allowedDirs) {
  const src = path.join(root, name);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error(`Required public directory missing: ${name}`);
  }
  fs.cpSync(src, path.join(out, name), { recursive: true });
}

// Preserve the existing clean-URL pages used by the legacy admin and OAuth UI.
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

console.log('BTCBOX unified public build created in dist/ (Strata customer app + legacy admin/OAuth assets).');
