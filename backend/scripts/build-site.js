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

// Copy unified BTCBOX brand static assets from the Vite frontend build to the
// site root so legacy admin/OAuth pages can resolve the same files.
// Files are copied only when present.
const brandAssets = [
  'favicon.svg', 'favicon.ico', 'apple-touch-icon.png',
  'logo-icon.svg', 'logo-horizontal.svg',
  'logo-16.png', 'logo-32.png', 'logo-48.png',
  'logo192.png', 'logo512.png',
];
for (const name of brandAssets) {
  const src = path.join(frontendDist, name);
  if (fs.existsSync(src) && fs.statSync(src).isFile()) {
    fs.copyFileSync(src, path.join(out, name));
  }
}

// Preserve the existing clean-URL pages used by the legacy admin and OAuth UI.
const pagesDir = path.join(root, 'pages');
for (const entry of fs.readdirSync(pagesDir)) {
  if (entry.endsWith('.html')) {
    fs.copyFileSync(path.join(pagesDir, entry), path.join(out, entry));
  }
}

// Overlay the BTCBOX Vite frontend as the customer-facing root.
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

console.log('BTCBOX unified public build created in dist/ (BTCBOX customer app + legacy admin/OAuth assets).');
