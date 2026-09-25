#!/usr/bin/env node
/**
 * Unauthenticated HTTP smoke test for every public Convex function.
 *
 * Verifies, for a live deployment, that each function:
 *   - is deployed and reachable (no 500 / no server crash)
 *   - rejects unauthenticated or unauthorised callers with a *domain* error
 *     ("Not authenticated" / "Forbidden" / "Not allowed" ...) rather than
 *     blowing up inside the server (the pattern that spiked the Convex
 *     dashboard's Failure Rate to 100%).
 *
 * Run: node scripts/convex-smoke.mjs [deploymentUrl]
 */
const URL_BASE = (process.argv[2] || "https://deafening-barracuda-870.convex.cloud").replace(
  /\/$/,
  "",
);

/** Errors that prove the function ran and deliberately refused the caller. */
const EXPECTED_GUARD = [
  "not authenticated",
  "unauthenticated",
  "forbidden",
  "not allowed",
  "unauthorized",
  "requires authentication",
];
/** Errors that prove argument validation ran (schema + handler wiring fine). */
const EXPECTED_VALIDATION = [
  "invalid argument",
  "argument validation",
  "expected",
  "is not a valid",
  "missing",
];
/** Errors that mean the server itself is broken. */
const FATAL = [
  "unhandled",
  "server error",
  "called the server without a valid license",
  "is not a function",
  "cannot read properties",
  "undefined is not",
  "convexerror",
  "not a valid license",
];

/** [module:fn, args, kind] */
const CALLS = [
  // ---- users ----
  ["users:currentUser", {}, "query", "public-null"],
  // ---- artisans ----
  ["artisans:getMyArtisan", {}, "query", "public-null"],
  ["artisans:listArtisans", {}, "query", "public-ok"],
  ["artisans:federationStats", {}, "query", "public-ok"],
  ["artisans:saveProfile", {}, "mutation", "validation"],
  ["artisans:submitQuiz", { score: 100 }, "mutation", "auth"],
  ["artisans:setPresence", { isOnline: true }, "mutation", "auth"],
  // ---- bookings ----
  ["bookings:create", {}, "mutation", "validation"],
  ["bookings:listForCustomer", {}, "query", "auth"],
  ["bookings:listForWorker", {}, "query", "public-ok"],
  ["bookings:listForAdmin", {}, "query", "auth"],
  ["bookings:getBooking", { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "query", "auth"],
  ["bookings:listMessages", { bookingId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "query", "auth"],
  ["bookings:sendMessage", { bookingId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", body: "hi" }, "mutation", "auth"],
  ["bookings:accept", { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "mutation", "auth"],
  ["bookings:advance", { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "mutation", "auth"],
  ["bookings:confirmUtr", { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", utr: "123456" }, "mutation", "auth"],
  ["bookings:cancel", { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", by: "customer" }, "mutation", "auth"],
  // ---- admin (all must refuse) ----
  ["admin:auditLog", {}, "query", "auth"],
  ["admin:earningsLedger", {}, "query", "auth"],
  ["admin:overview", {}, "query", "auth"],
  ["admin:workerDirectory", {}, "query", "auth"],
  ["admin:removedWorkers", {}, "query", "auth"],
  ["admin:memberList", {}, "query", "auth"],
  ["admin:amAdmin", {}, "query", "public-false"],
  ["admin:verificationQueue", {}, "query", "auth"],
  ["admin:reviewKyc", { artisanId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", approve: true }, "mutation", "auth"],
  ["admin:adminCancelBooking", { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "mutation", "auth"],
  ["admin:emergencyUnlock", { passcode: "definitely-wrong-passcode" }, "mutation", "public-ok"],
  // ---- workerAdmin ----
  ["workerAdmin:addWorker", {}, "mutation", "validation"],
  ["workerAdmin:removeWorker", { artisanId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "mutation", "auth"],
  ["workerAdmin:myNotifications", {}, "query", "public-ok"],
  ["workerAdmin:unreadCount", {}, "query", "public-zero"],
  ["workerAdmin:markAllRead", {}, "mutation", "auth"],
  // ---- workSamples ----
  ["workSamples:generateUploadUrl", { mimeType: "image/png" }, "mutation", "auth"],
  ["workSamples:completeUpload", {}, "mutation", "validation"],
  ["workSamples:deleteSample", { sampleId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "mutation", "auth"],
  ["workSamples:mySamples", {}, "query", "public-ok"],
  ["workSamples:reviewQueue", {}, "query", "auth"],
  ["workSamples:reviewSample", { sampleId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", approve: true }, "mutation", "auth"],
  ["workSamples:reviewKycFromSkillTab", { artisanId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", approve: true }, "mutation", "auth"],
  // ---- gis ----
  ["gis:mapData", {}, "query", "auth"],
  ["gis:radar", { bookingId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "query", "public-null"],
  ["gis:forecastContext", {}, "query", "auth"],
  // ---- disputes ----
  ["disputes:raise", {}, "mutation", "validation"],
  ["disputes:listForAdmin", {}, "query", "auth"],
  ["disputes:myDisputeForBooking", { bookingId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "query", "public-null"],
  ["disputes:resolve", { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", status: "resolved" }, "mutation", "auth"],
  ["disputes:myDisputes", {}, "query", "public-ok"],
  // ---- forecasts ----
  ["forecasts:save", {}, "mutation", "validation"],
  ["forecasts:publicLatest", {}, "query", "public-ok"],
  ["forecasts:latest", {}, "query", "public-null"],
  ["forecasts:history", {}, "query", "public-null"],
  // ---- forecastAi ----
  ["forecastAi:runForecast", {}, "action", "auth"],
  // ---- societies ----
  ["societies:directory", {}, "query", "public-ok"],
  ["societies:listForAdmin", {}, "query", "auth"],
  ["societies:register", {}, "mutation", "validation"],
  ["societies:review", { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", status: "approved" }, "mutation", "auth"],
  // ---- auth component (email OTP) ----
  ["auth/emailOtp:emailOtp", {}, "action", "public-ok"],
];

function classify(text) {
  const t = text.toLowerCase();
  if (FATAL.some((f) => t.includes(f))) return "FATAL";
  if (EXPECTED_GUARD.some((g) => t.includes(g))) return "guard";
  if (EXPECTED_VALIDATION.some((v) => t.includes(v))) return "validation";
  return "other";
}

async function call(path, args, kind) {
  const endpoint = kind === "query" ? "query" : kind === "action" ? "action" : "mutation";
  const res = await fetch(`${URL_BASE}/api/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { http: res.status, text, verdict: "FATAL" };
  }
  if (res.status >= 500) return { http: res.status, text: text.slice(0, 400), verdict: "FATAL" };
  if (json.status === "success") return { http: res.status, value: json.value, verdict: "ok" };
  const msg = String(json.errorMessage || json.errorData?.message || text).slice(0, 300);
  return { http: res.status, msg, verdict: classify(msg) };
}

const results = [];
console.log(`Smoke-testing ${CALLS.length} Convex functions against ${URL_BASE}\n`);

for (const [path, args, kind, expect] of CALLS) {
  let r;
  try {
    r = await call(path, args, kind);
  } catch (e) {
    r = { http: 0, msg: `network: ${e.message}`, verdict: "FATAL" };
  }
  let status = "ok";
  if (r.verdict === "FATAL") status = "FAIL";
  else if (expect === "auth" && r.verdict !== "guard") status = "FAIL";
  else if (expect === "validation" && r.verdict !== "validation" && r.verdict !== "guard")
    status = "FAIL";
  else if (expect === "public-null" && !(r.verdict === "ok" && r.value == null)) status = "FAIL";
  else if (expect === "public-false" && !(r.verdict === "ok" && r.value === false)) status = "FAIL";
  else if (expect === "public-zero" && !(r.verdict === "ok" && r.value === 0)) status = "FAIL";
  else if (expect === "public-ok" && r.verdict !== "ok") status = "FAIL";
  if (expect === "public-ok" && status === "ok" && r.value === undefined) status = "WARN";

  results.push({ path, expect, status, ...r });
  const detail =
    r.verdict === "ok"
      ? `ok ${JSON.stringify(r.value)?.slice(0, 70)}`
      : `${r.verdict}: ${(r.msg || r.text || "").slice(0, 110)}`;
  console.log(
    `${status === "ok" ? "  ." : status === "WARN" ? "  ~" : "  X"} ${path.padEnd(42)} ${detail}`,
  );
}

const fails = results.filter((r) => r.status === "FAIL");
const warns = results.filter((r) => r.status === "WARN");
console.log(
  `\n${results.length - fails.length - warns.length}/${results.length} ok, ${warns.length} warn, ${fails.length} FAIL`,
);
if (fails.length) {
  console.log("\nFAILURES:");
  for (const f of fails) {
    console.log(
      `  ${f.path} (expected ${f.expect}) -> ${f.verdict}: ${(f.msg || f.text || "").slice(0, 200)}`,
    );
  }
}
process.exit(fails.length ? 1 : 0);
