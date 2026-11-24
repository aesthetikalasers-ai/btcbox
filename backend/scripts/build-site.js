'use strict';

// Build an allowlisted public directory. Source code, SQL migrations, tests,
// environment templates, and operational documentation stay in GitHub only.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const staging = path.join(root, '.dist-staging-' + process.pid);
const frontendDist = path.resolve(root, '..', 'frontend', 'dist');
const frontendIndex = path.join(frontendDist, 'index.html');
const frontendAssets = path.join(frontendDist, 'frontend-assets');
const allowedFiles = ['index.html'];
const allowedDirs = ['oauth'];
const requiredBrandFiles = ['btcbox-logo.png', 'btcbox-icon.png', 'btcbox-logo-white.png'];

// Validate all required inputs before touching the existing dist directory.
for (const name of allowedFiles) {
  const src = path.join(root, name);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
    throw new Error(`Required public entry file missing: ${name}`);
  }
}
for (const name of allowedDirs) {
  const src = path.join(root, name);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error(`Required public directory missing: ${name}`);
  }
}
const tokensCss = path.join(root, 'assets', 'css', 'tokens.css');
if (!fs.existsSync(tokensCss) || !fs.statSync(tokensCss).isFile()) {
  throw new Error('Required OAuth design tokens are missing');
}
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
for (const name of requiredBrandFiles) {
  const source = path.join(frontendDist, 'brand', name);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`Required official brand asset missing: ${name}`);
  }
}

try {
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  for (const name of allowedFiles) {
    fs.copyFileSync(path.join(root, name), path.join(staging, name));
  }
  for (const name of allowedDirs) {
    fs.cpSync(path.join(root, name), path.join(staging, name), { recursive: true });
  }

  const publicCssDir = path.join(staging, 'assets', 'css');
  fs.mkdirSync(publicCssDir, { recursive: true });
  fs.copyFileSync(tokensCss, path.join(publicCssDir, 'tokens.css'));

  fs.copyFileSync(frontendIndex, path.join(staging, 'index.html'));
  fs.cpSync(frontendAssets, path.join(staging, 'frontend-assets'), { recursive: true });

  const brandOutput = path.join(staging, 'brand');
  fs.mkdirSync(brandOutput, { recursive: true });
  for (const name of requiredBrandFiles) {
    fs.copyFileSync(path.join(frontendDist, 'brand', name), path.join(brandOutput, name));
  }

  const tokenIconInput = path.join(frontendDist, 'token-icons');
  const tokenIconOutput = path.join(staging, 'token-icons');
  if (fs.existsSync(tokenIconInput) && fs.statSync(tokenIconInput).isDirectory()) {
    fs.mkdirSync(tokenIconOutput, { recursive: true });
    fs.cpSync(tokenIconInput, tokenIconOutput, { recursive: true });
  }

  fs.rmSync(out, { recursive: true, force: true });
  fs.renameSync(staging, out);
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}

console.log('BTCBOX unified public build created in dist/ (React customer/admin app + retained OAuth consent assets).');
