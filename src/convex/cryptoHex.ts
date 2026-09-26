/**
 * HMAC-SHA256 helpers shared by the Razorpay checkout verification (node
 * runtime) and the webhook receiver (V8 runtime).
 *
 * Both runtimes have a different crypto stack, so the algorithm is spelled out
 * once here behind a tiny interface: hmacHex returns the digest as lowercase
 * hex, and timingSafeEqualHex compares two hex digests in constant time.
 */

/**
 * HMAC-SHA256 of `payload` keyed with `secret`, as lowercase hex.
 *
 * Uses Web Crypto (available in both the V8 and node runtimes) rather than
 * node:crypto, so this file can be imported from either.
 */
export async function hmacHex(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time comparison of two hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
