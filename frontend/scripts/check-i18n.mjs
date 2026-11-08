import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/lib/i18n.tsx"), "utf8");
const locales = ["en", "ja", "zh-CN", "es", "vi", "it", "pt"];
const markers = {
  en: "  en: {",
  ja: "  ja: {",
  "zh-CN": '  "zh-CN": {',
  es: "  es: {",
  vi: "  vi: {",
  it: "  it: {",
  pt: "  pt: {",
};

function readLocale(locale) {
  const marker = markers[locale];
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing locale dictionary: ${locale}`);
  const bodyStart = start + marker.length;
  const nextLocaleStart = locales
    .map((name) => source.indexOf(markers[name], bodyStart))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const end = nextLocaleStart ?? source.indexOf("\n};", bodyStart);
  if (end < 0) throw new Error(`Unterminated locale dictionary: ${locale}`);
  const body = source.slice(bodyStart, end);
  const keys = [];
  const pattern = /(?:^|,)\\s*(?:"((?:\\\\.|[^"\\\\])*)"|([A-Za-z_$][\\w$]*))\\s*:/gm;
  for (const match of body.matchAll(pattern)) {
    keys.push(match[1] ? JSON.parse(`"${match[1]}"`) : match[2]);
  }
  return keys;
}

const dictionaries = Object.fromEntries(locales.map((locale) => [locale, readLocale(locale)]));
const canonical = new Set(dictionaries.ja);
let failed = false;

for (const locale of locales) {
  const keys = dictionaries[locale];
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  const missing = locale === "en" ? [] : [...canonical].filter((key) => !keys.includes(key));
  console.log(`${locale}: ${keys.length} keys; ${missing.length} missing; ${duplicates.length} duplicate`);
  if (duplicates.length) {
    failed = true;
    console.error(`  Duplicate keys: ${duplicates.slice(0, 12).join(" | ")}`);
  }
  if (missing.length) {
    failed = true;
    console.error(`  Missing keys: ${missing.slice(0, 20).join(" | ")}`);
  }
}

if (failed) process.exitCode = 1;
else console.log("All locale dictionaries match the Japanese source-key set.");
