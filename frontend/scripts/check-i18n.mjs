import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const sourceRoot = path.resolve(process.cwd(), "src");
const i18nPath = path.join(sourceRoot, "lib", "i18n.tsx");
const localeOrder = ["en", "ja", "zh-CN", "es", "vi", "it", "pt"];

function propertyName(node) {
  if (!node) return undefined;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return undefined;
}

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return /\\.tsx?$/.test(entry.name) && fullPath !== i18nPath ? [fullPath] : [];
  });
}

const i18nText = fs.readFileSync(i18nPath, "utf8");
const i18nFile = ts.createSourceFile(i18nPath, i18nText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let dictionariesNode;
function findDictionaries(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(i18nFile) === "dictionaries") dictionariesNode = node.initializer;
  ts.forEachChild(node, findDictionaries);
}
findDictionaries(i18nFile);
if (!dictionariesNode || !ts.isObjectLiteralExpression(dictionariesNode)) {
  throw new Error("Could not parse the dictionaries object in src/lib/i18n.tsx");
}

const dictionaries = new Map();
for (const localeProperty of dictionariesNode.properties) {
  if (!ts.isPropertyAssignment(localeProperty) || !ts.isObjectLiteralExpression(localeProperty.initializer)) continue;
  const locale = propertyName(localeProperty.name);
  if (!locale) continue;
  const keys = new Set();
  for (const entry of localeProperty.initializer.properties) {
    if (ts.isPropertyAssignment(entry)) {
      const key = propertyName(entry.name);
      if (key !== undefined) keys.add(key);
    }
  }
  dictionaries.set(locale, keys);
}

const usages = new Map();
let dynamicCalls = 0;
for (const filePath of collectFiles(sourceRoot)) {
  const text = fs.readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t") {
      const argument = node.arguments[0];
      if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
        const key = argument.text;
        const location = source.getLineAndCharacterOfPosition(node.getStart(source));
        const entries = usages.get(key) || [];
        entries.push({ file: path.relative(process.cwd(), filePath), line: location.line + 1 });
        usages.set(key, entries);
      } else {
        dynamicCalls += 1;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

const sourceKeys = [...usages.keys()];
let hasMissing = false;
console.log(`Static translation keys: ${sourceKeys.length}`);
console.log(`Dynamic translation calls requiring runtime review: ${dynamicCalls}`);
for (const locale of localeOrder) {
  if (locale === "en") {
    console.log("en: source language (unmapped keys display the English source string)");
    continue;
  }
  const dictionary = dictionaries.get(locale);
  if (!dictionary) {
    console.error(`${locale}: dictionary not found`);
    hasMissing = true;
    continue;
  }
  const missing = sourceKeys.filter((key) => !dictionary.has(key));
  const translated = sourceKeys.length - missing.length;
  const percentage = sourceKeys.length ? ((translated / sourceKeys.length) * 100).toFixed(1) : "100.0";
  console.log(`${locale}: ${translated}/${sourceKeys.length} (${percentage}%), missing ${missing.length}`);
  for (const key of missing) {
    const first = usages.get(key)?.[0];
    console.log(`  - ${first?.file}:${first?.line} ${JSON.stringify(key)}`);
  }
  if (missing.length) hasMissing = true;
}
if (hasMissing) process.exitCode = 1;
