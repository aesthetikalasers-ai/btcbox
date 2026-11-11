import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/lib/i18n.tsx"), "utf8");
const locales = ["en", "ja", "zh-CN", "es", "pt", "it", "de"];
const preservedLegacyLocales = ["vi"];
const allLocales = ["en", "ja", "zh-CN", "es", "vi", "it", "pt", "de"];
const markers = {
  en: "  en: {",
  ja: "  ja: {",
  "zh-CN": '  "zh-CN": {',
  es: "  es: {",
  vi: "  vi: {",
  de: "  de: {",
  it: "  it: {",
  pt: "  pt: {",
};

function readLocale(locale) {
  const marker = markers[locale];
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("Missing locale dictionary: " + locale);
  const bodyStart = start + marker.length;
  const nextLocaleStart = allLocales
    .map((name) => source.indexOf(markers[name], bodyStart))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const end = nextLocaleStart ?? source.indexOf("\n};", bodyStart);
  if (end < 0) throw new Error("Unterminated locale dictionary: " + locale);
  const body = source.slice(bodyStart, end);
  const keys = [];
  const invalid = [];
  const pattern = /(?:^|,)\s*("(?:\\.|[^"\\])*"|[A-Za-z_$][\w$]*)\s*:\s*("(?:\\.|[^"\\])*"|undefined|null)/gm;
  for (const match of body.matchAll(pattern)) {
    const rawKey = match[1];
    const key = rawKey.startsWith('"') ? JSON.parse(rawKey) : rawKey;
    keys.push(key);
    if (match[2].trim() === "undefined" || match[2].trim() === "null") invalid.push(key);
  }
  return { keys, invalid };
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  });
}

const dictionaries = Object.fromEntries(allLocales.map((locale) => [locale, readLocale(locale)]));
const canonical = new Set(dictionaries.en.keys);
let failed = false;

for (const locale of locales) {
  const { keys, invalid } = dictionaries[locale];
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  const missing = [...canonical].filter((key) => !keys.includes(key));
  const coverage = canonical.size ? ((keys.length - duplicates.length) / canonical.size * 100).toFixed(1) : "0.0";
  console.log(locale + ": " + keys.length + " keys; " + coverage + "% coverage; " + missing.length + " missing; " + duplicates.length + " duplicate; " + invalid.length + " invalid values");
  if (duplicates.length || missing.length || invalid.length) failed = true;
  if (duplicates.length) console.error("  Duplicate keys: " + duplicates.slice(0, 12).join(" | "));
  if (missing.length) console.error("  Missing keys: " + missing.slice(0, 20).join(" | "));
  if (invalid.length) console.error("  Invalid values: " + invalid.slice(0, 20).join(" | "));
}

const usedKeys = new Set();
const callPattern = /\bt\(\s*(["'])(.*?)\1\s*\)/gs;
for (const path of walk(resolve(root, "src")).filter((path) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)))) {
  const code = readFileSync(path, "utf8");
  for (const match of code.matchAll(callPattern)) usedKeys.add(match[2]);
}
const missingUsed = [...usedKeys].filter((key) => !canonical.has(key));
console.log("Static t() calls: " + usedKeys.size + "; keys absent from English dictionary: " + missingUsed.length);
if (missingUsed.length) {
  failed = true;
  console.error("  Unregistered t() keys: " + missingUsed.slice(0, 100).join(" | "));
}

for (const locale of preservedLegacyLocales) {
  const { keys, invalid } = dictionaries[locale];
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  const missing = [...canonical].filter((key) => !keys.includes(key));
  console.log(locale + " (legacy): " + keys.length + " keys; " + missing.length + " missing; " + duplicates.length + " duplicate; " + invalid.length + " invalid values");
  if (duplicates.length || missing.length || invalid.length) failed = true;
}

if (failed) process.exitCode = 1;
else console.log("All locale dictionaries and static translation calls are complete.");
