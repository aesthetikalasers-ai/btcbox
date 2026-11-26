import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Verifies that docs/BTCBOX-UI-VISUAL-STANDARDS-V1.md still describes the code.
// The document is the acceptance standard, so drift in either direction is a
// failure: a token changed in index.css without a doc update, a documented route
// that no longer exists, or a viewport the suite no longer sweeps.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(root, "..");
const read = (path) => readFileSync(path, "utf8");

const doc = read(resolve(repo, "docs/BTCBOX-UI-VISUAL-STANDARDS-V1.md"));
const css = read(resolve(root, "src/index.css"));
const app = read(resolve(root, "src/App.tsx"));
const i18n = read(resolve(root, "src/lib/i18n.tsx"));
const spec = read(resolve(root, "e2e/responsive-visual-qa.spec.ts"));
const playwright = read(resolve(root, "playwright.config.ts"));

const failures = [];
const warnings = [];
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);
const squeeze = (value) => value.replace(/\s+/g, "");

// ---------- 1. Required sections ----------
for (const heading of [
  "## 0. 文档地位与事实来源",
  "## 1. 视觉方向（不可协商）",
  "## 2. 颜色 token",
  "## 3. 字体与排版",
  "## 4. 布局、容器与间距",
  "## 5. 控件节奏",
  "## 6. 组件契约",
  "## 7. 状态与反馈",
  "## 8. 文案与国际化",
  "## 9. 动效",
  "## 10. 验收分层（四层全部必过）",
  "## 11. 路由覆盖矩阵",
  "## 12. 已知偏差（修复前必须显式豁免）",
  "## 13. 变更检查清单",
]) {
  if (!doc.includes(heading)) fail(`document is missing section: ${heading}`);
}
for (const layer of ["L1 全站一致性", "L2 移动端独立验收", "L3 桌面端独立验收", "L4 连续响应式"]) {
  if (!doc.includes(layer)) fail(`document is missing acceptance layer: ${layer}`);
}

// ---------- 2. Colour tokens ----------
const tokens = {
  "--color-brand-accent": "#0ECB81",
  "--color-brand-bg": "#0B0E11",
  "--color-brand-surface": "#181A20",
  "--color-brand-surface-2": "#12161C",
  "--color-brand-surface-hover": "#1E2329",
  "--color-brand-border": "#2B3139",
  "--color-brand-border-strong": "#3A424B",
  "--color-brand-text": "#FFFFFF",
  "--color-brand-text-secondary": "#B7BDC6",
  "--color-brand-text-muted": "#A6B0BD",
  "--color-brand-text-faint": "#6B7480",
  "--color-brand-text-disabled": "#474D57",
  "--color-brand-danger": "#F6465D",
  "--color-brand-success": "#0ECB81",
  "--color-brand-warning": "#f0b90b",
  "--color-brand-info": "#72AEF2",
};
for (const [name, value] of Object.entries(tokens)) {
  const match = css.match(new RegExp(name + "\\s*:\\s*([^;]+);"));
  if (!match) { fail(`index.css no longer defines ${name}`); continue; }
  if (match[1].trim().toLowerCase() !== value.toLowerCase()) {
    fail(`${name} is ${match[1].trim()} in index.css but ${value} in the standard`);
  }
  // The documented table row for this token must carry the same value; a stray
  // mention of the hex elsewhere in the document is not enough.
  const short = name.replace("--color-", "");
  const documented = doc.split("\n").some((line) => line.includes("`" + short + "`") && line.includes(value));
  if (!documented) fail(`document has no table row pairing \`${short}\` with ${value}`);
}

// ---------- 3. Control rhythm ----------
for (const [name, value] of Object.entries({
  "--bf-control-h": "40px",
  "--bf-quick-h": "30px",
  "--bf-cta-h": "44px",
  "--bf-radius": "8px",
  "--bf-radius-sm": "6px",
  "--bf-nav-h": "60px",
  "--bf-chart-bar-h": "36px",
})) {
  const match = css.match(new RegExp(name + "\\s*:\\s*([^;]+);"));
  if (!match) { fail(`index.css no longer defines ${name}`); continue; }
  if (match[1].trim() !== value) fail(`${name} is ${match[1].trim()} but the standard says ${value}`);
  if (!doc.includes(value)) fail(`document does not mention ${name} = ${value}`);
}

// ---------- 4. Type scale ----------
// `.type-page-title` is declared twice; the later declaration wins, so the check
// reads the last definition rather than the first one it finds.
function typeScale(className) {
  // Anchor to a line start so scoped overrides such as `.spot-terminal .type-page-title`
  // are not mistaken for the global definition.
  const matches = [...css.matchAll(new RegExp("(?:^|\\n)[ \\t]*\\." + className + "\\s*\\{([^}]*)\\}", "g"))];
  if (matches.length === 0) return null;
  const body = matches[matches.length - 1][1];
  const size = body.match(/font-size\s*:\s*([^;]+);/);
  return size ? squeeze(size[1]) : null;
}
const expectedScale = {
  "type-display": "clamp(1.875rem,5vw,2.5rem)",
  "type-page-title": "clamp(1.4rem,2.5vw,1.85rem)",
  "type-section-title": "1.0625rem",
  "type-card-title": "1rem",
  "type-body": ".9375rem",
  "type-body-compact": ".875rem",
  "type-label": ".8125rem",
  "type-meta": ".78125rem",
  "type-micro": ".71875rem",
  "type-price": "clamp(1.375rem,4vw,1.875rem)",
};
for (const [className, expected] of Object.entries(expectedScale)) {
  const actual = typeScale(className);
  if (!actual) { fail(`index.css no longer defines .${className}`); continue; }
  if (actual !== expected) fail(`.${className} is ${actual} but the standard says ${expected}`);
}

// ---------- 5. Routes ----------
const documented = [...doc.matchAll(/^\|\s*`(\/[^`]*)`\s*\|/gm)].map((match) => match[1]);
if (documented.length === 0) fail("the route matrix in section 11 has no rows");
const declared = new Set([...app.matchAll(/path="([^"]+)"/g)].map((match) => match[1]));
for (const route of documented) {
  if (!declared.has(route)) fail(`document lists route ${route} but App.tsx does not declare it`);
}
const undocumented = [...declared].filter((route) => !documented.includes(route) && route !== "*" && route !== "/*" && route !== "/admin/*");
if (undocumented.length) {
  fail("App.tsx declares routes that section 11 does not document: " + undocumented.join(", "));
}

// The Playwright route sweep is a subset of the product surface; every path it
// visits must be a documented route (a parameterised row such as `/trade/:symbol`
// covers `/trade/BTCUSDT`).
const swept = [...spec.matchAll(/\{\s*path:\s*"([^"]+)"/g)].map((match) => match[1]);
const covers = (route) => documented.some((entry) =>
  entry === route || new RegExp("^" + entry.replace(/:[A-Za-z]+/g, "[^/]+") + "$").test(route));
for (const route of swept) {
  if (!covers(route)) fail(`responsive-visual-qa.spec.ts sweeps ${route}, which section 11 does not document`);
}

// ---------- 6. Acceptance viewports ----------
function widthsFrom(constant) {
  const block = spec.match(new RegExp("const " + constant + "\\s*=\\s*\\[([\\s\\S]*?)\\];"));
  if (!block) return [];
  return [...block[1].matchAll(/\d+/g)].map((match) => Number(match[0]));
}
const mobile = widthsFrom("mobileWidths");
const fixed = widthsFrom("fixedWidths");
const continuity = widthsFrom("continuityWidths");
if (mobile.length === 0 || fixed.length === 0 || continuity.length === 0) {
  fail("responsive-visual-qa.spec.ts no longer exports the mobileWidths/fixedWidths/continuityWidths arrays");
}
for (const [label, widths] of [["L2", mobile], ["L3", fixed], ["L4", continuity]]) {
  for (const width of widths) {
    if (!doc.includes(String(width))) fail(`viewport ${width}px is swept by ${label} but is not listed in the standard`);
  }
}
if (!playwright.includes("baseURL: \"http://127.0.0.1:4173\"")) fail("playwright.config.ts baseURL changed; the standard documents 4173");
for (const project of ["mobile-chromium", "desktop-chromium"]) {
  if (!playwright.includes(project)) fail(`playwright.config.ts no longer defines the ${project} project`);
}

// ---------- 7. Locales ----------
const languageUnion = i18n.match(/export type Language =([^;]+);/);
if (!languageUnion) fail("i18n.tsx no longer declares the Language union");
else {
  const languages = [...languageUnion[1].matchAll(/"([a-zA-Z-]+)"/g)].map((match) => match[1]);
  const listed = doc.match(/支持语言\*\*：([^\n]+)/);
  if (!listed) fail("section 8 does not list the supported languages");
  else {
    for (const language of languages) {
      if (!listed[1].includes("`" + language + "`")) fail(`language ${language} is supported by i18n.tsx but not documented`);
    }
  }
}

// ---------- 8. Component classes documented in §6.4 must exist ----------
// These were referenced by components/ui/select.tsx and empty-state.tsx for a long
// time without any definition (see the fixed-deviation note in §12). Now that the
// standard documents them as styled primitives, their absence is a regression.
for (const className of [
  "field-control",
  "field-textarea",
  "empty-state",
  "empty-state-icon",
  "empty-state-title",
  "empty-state-hint",
]) {
  if (!new RegExp("\\." + className + "\\s*\\{").test(css)) {
    fail(`components/ui uses .${className}, but index.css no longer defines it`);
  }
}
if (!/select\.field-control\s*\{/.test(css)) {
  fail("select.field-control lost its arrow styling; Select sets appearance-none and would render without an indicator");
}

// ---------- report ----------
for (const message of warnings) console.warn("warning: " + message);
if (failures.length) {
  console.error("UI visual standard check failed (" + failures.length + "):");
  for (const message of failures) console.error("  - " + message);
  process.exitCode = 1;
} else {
  console.log("UI visual standard matches the code: tokens, type scale, " + documented.length + " routes, " +
    (mobile.length + fixed.length + continuity.length) + " viewport checks, locales, known deviations.");
}

