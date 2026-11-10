import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const locales = ["en", "ja", "zh-CN", "es", "pt", "it", "de"];
const preservedLegacyLocales = ["vi"];
const allLocales = ["en", "ja", "zh-CN", "es", "vi", "it", "pt", "de"];
function readLocale(locale) {
  const source = readFileSync(resolve(root, "src/lib/locales", locale + ".json"), "utf8");
  const dictionary = JSON.parse(source);
  // Inspect the raw keys as well: JSON.parse alone silently accepts duplicates.
  const keys = [...source.matchAll(/(?:^|[,{])\s*("(?:\\.|[^"\\])*")\s*:/gm)].map((match) => JSON.parse(match[1]));
  const invalid = Object.entries(dictionary)
    .filter(([, value]) => typeof value !== "string" || value.trim() === "")
    .map(([key]) => key);
  return { keys, invalid, values: dictionary };
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

// Recovery copy must remain readable when the full language file cannot load.
const loadingMessages = JSON.parse(readFileSync(resolve(root, "src/lib/locales/loading-messages.json"), "utf8"));
for (const locale of locales) {
  for (const key of ["Loading…", "Unable to load this language. Please try again.", "Try again"]) {
    if (loadingMessages[locale]?.[key] !== dictionaries[locale].values[key]) {
      failed = true;
      console.error("Loading message differs from dictionary: " + locale + ": " + key);
    }
  }
}

// Catch misplaced translation blocks across scripts. This supplements key coverage;
// languages sharing the Latin alphabet still require linguistic review.
for (const locale of ["zh-CN", "es", "pt", "it", "de"]) {
  const unexpectedScript = locale === "zh-CN" ? /[\u3040-\u30ff]/ : /[\u3040-\u30ff\u4e00-\u9fffĐđƯưƠơĂă]/;
  for (const [key, text] of Object.entries(dictionaries[locale].values)) {
    if (unexpectedScript.test(text)) {
      failed = true;
      console.error("Unexpected script in " + locale + ": " + key);
    }
  }
}

const usedKeys = new Set();
const callPattern = /\bt\(\s*(["'])(.*?)\1\s*\)/gs;
for (const path of walk(resolve(root, "src")).filter((path) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(path)))) {
  const code = readFileSync(path, "utf8");
  for (const match of code.matchAll(callPattern)) usedKeys.add(match[2]);
}
// Dynamic market filter labels are passed through t(label), so they are not visible to the static t("key") scanner.
for (const key of ["Gainers", "Losers"]) usedKeys.add(key);
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
