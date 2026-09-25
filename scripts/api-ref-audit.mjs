#!/usr/bin/env node
/**
 * Static cross-check: every `api.<module>.<fn>` reference in the frontend must
 * map to a real exported Convex function, and every exported public function
 * should be reachable from the frontend (or intentionally internal).
 *
 * Run: node scripts/api-ref-audit.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const CONVEX = join(SRC, "convex");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "_generated" || name === "node_modules") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

// ---- 1. collect exported Convex public functions ----
const serverFns = new Map(); // "module:fn" -> kind
for (const file of walk(CONVEX)) {
  const mod = relative(CONVEX, file).replace(/\\/g, "/").replace(/\.ts$/, "");
  if (mod.startsWith("auth/") || mod === "auth.config" || mod === "schema") continue;
  const src = readFileSync(file, "utf8");
  const re = /^export const (\w+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction|httpAction)\s*\(/gm;
  let m;
  while ((m = re.exec(src))) {
    serverFns.set(`${mod}:${m[1]}`, { kind: m[2], file: relative(ROOT, file) });
  }
}

// ---- 2. collect frontend references ----
const refs = new Map(); // "module:fn" -> [files]
const IMPORT_ALIASES = new Map(); // alias -> real module
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (rel.startsWith("src/convex/")) continue;
  const src = readFileSync(file, "utf8");

  // import { api, type AnyApi } from "@/convex/server";
  const importRe = /import\s*\{([^}]*)\}\s*from\s*["']@\/convex\/server["']/g;
  let im;
  while ((im = importRe.exec(src))) {
    for (const part of im[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) IMPORT_ALIASES.set(name, "api");
    }
  }

  const refRe = /\bapi\.(\w+)\.(\w+)/g;
  let r;
  while ((r = refRe.exec(src))) {
    const key = `${r[1]}:${r[2]}`;
    if (!refs.has(key)) refs.set(key, []);
    refs.get(key).push(rel);
  }
}

// ---- 3. report ----
let problems = 0;
console.log(`Convex public functions exported: ${serverFns.size}`);
console.log(`Frontend api.* references:        ${refs.size}\n`);

const broken = [];
for (const [key, files] of refs) {
  if (!serverFns.has(key)) broken.push({ key, files });
}
if (broken.length) {
  problems += broken.length;
  console.log("BROKEN REFERENCES (frontend calls a function that does not exist):");
  for (const b of broken) {
    console.log(`  x ${b.key}  <- ${[...new Set(b.files)].join(", ")}`);
  }
  console.log("");
}

const unused = [...serverFns.keys()].filter(
  (k) => !refs.has(k) && !k.startsWith("auth/") && !k.endsWith(":emailOtp"),
);
if (unused.length) {
  console.log("EXPORTED BUT NOT CALLED BY THE FRONTEND (dead surface / candidate for removal):");
  for (const u of unused) console.log(`  - ${u}  (${serverFns.get(u).kind})`);
  console.log("");
}

const internal = [...serverFns.values()].filter((f) => f.kind.startsWith("internal"));
if (internal.length) {
  console.log("INTERNAL functions (not callable from the client):");
  for (const f of internal) console.log(`  - ${f.file}`);
  console.log("");
}

if (!broken.length) console.log("OK: every frontend api.* reference resolves to a real Convex function.");
process.exit(problems ? 1 : 0);
