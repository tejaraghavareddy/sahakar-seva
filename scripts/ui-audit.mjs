#!/usr/bin/env node
/**
 * Static UI audit for Sahakar Seva:
 *  1. <button> elements without onClick/type=submit (dead buttons)
 *  2. Link to="/..." targets vs registered routes
 *  3. t("key") keys vs i18n dictionary (en)
 *  4. api.<file>.<fn> references vs Convex exports
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";

const SRC = "src";
const issues = [];

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(f) && !/\.test\./.test(f) && !/_generated/.test(p)) out.push(p);
  }
  return out;
}

/** Strip // and block comments (string-aware, template-aware). */
function stripComments(src) {
  let out = "", i = 0, n = src.length;
  let mode = "code"; // code | line | block | squote | dquote | template
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === "code") {
      if (c === "/" && d === "/") { mode = "line"; i += 2; continue; }
      if (c === "/" && d === "*") { mode = "block"; i += 2; continue; }
      if (c === "'") mode = "squote";
      else if (c === '"') mode = "dquote";
      else if (c === "`") mode = "template";
      out += c; i++;
    } else if (mode === "line") {
      if (c === "\n") { mode = "code"; out += c; }
      i++;
    } else if (mode === "block") {
      if (c === "*" && d === "/") { mode = "code"; out += " "; i += 2; }
      else { if (c === "\n") out += c; i++; }
    } else {
      // inside a string literal — copy verbatim, honor escapes
      if (c === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
      if ((mode === "squote" && c === "'") || (mode === "dquote" && c === '"') || (mode === "template" && c === "`")) mode = "code";
      out += c; i++;
    }
  }
  return out;
}

const files = walk(SRC).filter((f) => !f.includes("vly-toolbar-readonly"));
const stripped = new Map(files.map((f) => [f, stripComments(readFileSync(f, "utf8"))]));

/* ── 1. Buttons without handlers ── */
for (const [file, src] of stripped) {
  if (!file.endsWith(".tsx")) continue;
  const buttonRe = /<button\b([^>]*)>/g;
  let m;
  while ((m = buttonRe.exec(src))) {
    const attrs = m[1];
    // Props spread may deliver onClick from the caller (e.g. TlButton).
    if (/onClick=/.test(attrs) || /\{\.\.\./.test(attrs)) continue;
    if (/type=\{?"?(submit|button)/.test(attrs)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    issues.push(`[dead-button?] ${relative(".", file)}:${line} <button> without onClick or type=submit`);
  }
}

/* ── 2. Route link check ── */
const appSrc = stripped.get(join(SRC, "App.tsx")) ?? "";
const routes = new Set();
const routeRe = /path="([^"]*)"/g;
let rm;
while ((rm = routeRe.exec(appSrc))) routes.add(rm[1]);
for (const r of [...routes]) if (r.includes("/:")) routes.add(r.split("/:")[0]);

for (const [file, src] of stripped) {
  const linkRe = /to=\{?"([^"{]*)"/g;
  let m;
  while ((m = linkRe.exec(src))) {
    const to = m[1].split("?")[0].split("#")[0];
    if (!to.startsWith("/")) continue;
    const base = "/" + to.split("/")[1];
    if (!routes.has(to) && !routes.has(base)) {
      const line = src.slice(0, m.index).split("\n").length;
      issues.push(`[bad-link] ${relative(".", file)}:${line} Link to="${m[1]}" matches no route`);
    }
  }
}

/* ── 3. i18n key check ── */
const i18nPath = join(SRC, "lib", "i18n.tsx");
const i18nSrc = stripComments(readFileSync(i18nPath, "utf8"));
const enKeys = new Set();
{
  const startMatch = i18nSrc.match(/const\s+en\s*:\s*Dict\s*=\s*\{/);
  if (startMatch && startMatch.index !== undefined) {
    const objStart = i18nSrc.indexOf("{", startMatch.index);
    let depth = 0, endIdx = objStart;
    for (let i = objStart; i < i18nSrc.length; i++) {
      if (i18nSrc[i] === "{") depth++;
      else if (i18nSrc[i] === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const block = i18nSrc.slice(objStart, endIdx);
    const keyRe = /(?:^|[{,\n])\s*([a-zA-Z0-9_]+)\s*:/g;
    let km;
    while ((km = keyRe.exec(block))) enKeys.add(km[1]);
  }
}

for (const [file, src] of stripped) {
  if (file.includes("i18n")) continue;
  const tRe = /\bt\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g;
  let m;
  while ((m = tRe.exec(src))) {
    if (!enKeys.has(m[1])) {
      const line = src.slice(0, m.index).split("\n").length;
      issues.push(`[missing-i18n] ${relative(".", file)}:${line} t("${m[1]}") not found in en dictionary`);
    }
  }
}

/* ── 4. Convex api reference check ── */
const convexDir = join(SRC, "convex");
const modules = new Map();
for (const f of readdirSync(convexDir)) {
  if (f.endsWith(".ts") && !/_generated|schema|auth\.config|http/.test(f)) {
    modules.set(f.replace(/\.ts$/, ""), new Set());
  }
}
for (const [mod, fns] of modules) {
  const modSrc = stripComments(readFileSync(join(convexDir, `${mod}.ts`), "utf8"));
  const fnRe = /export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\b/g;
  let fm;
  while ((fm = fnRe.exec(modSrc))) fns.add(fm[1]);
}

for (const [file, src] of stripped) {
  const apiRe = /\bapi\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\b/g;
  let m;
  while ((m = apiRe.exec(src))) {
    const [, mod, fn] = m;
    const line = src.slice(0, m.index).split("\n").length;
    if (!modules.has(mod)) {
      issues.push(`[bad-api-module] ${relative(".", file)}:${line} api.${mod}.${fn} — module "${mod}" not found`);
    } else if (!modules.get(mod).has(fn)) {
      issues.push(`[bad-api-fn] ${relative(".", file)}:${line} api.${mod}.${fn} — not exported as query/mutation/action`);
    }
  }
}

if (issues.length === 0) {
  console.log("UI AUDIT CLEAN — no issues found");
} else {
  console.log(`UI AUDIT — ${issues.length} issue(s):\n`);
  for (const i of issues) console.log("  " + i);
  process.exitCode = 1;
}
