/**
 * The webhook's HMAC is the only thing standing between a stranger and a
 * free booking, so the helper is checked against a known-good HMAC-SHA256
 * rather than against itself.
 */
import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hmacHex, timingSafeEqualHex } from "@/convex/cryptoHex";

/** node:crypto is the reference implementation the webhook is checked against. */
const reference = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload, "utf8").digest("hex");

describe("hmacHex", () => {
  const cases: [string, string][] = [
    ["order_abc|pay_1", "s"],
    ["", "secret"],
    ["a".repeat(1000), "another-secret"],
  ];

  it("matches node:crypto's HMAC-SHA256", async () => {
    for (const [payload, secret] of cases) {
      expect(await hmacHex(payload, secret)).toBe(reference(payload, secret));
    }
  });

  it("returns lowercase hex of the right length", async () => {
    const hex = await hmacHex("order_abc|pay_1", "s");
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes with the secret, so keys cannot be swapped", async () => {
    expect(await hmacHex("payload", "key-one")).not.toBe(
      await hmacHex("payload", "key-two"),
    );
  });

  it("hashes the utf-8 bytes, not the code units", async () => {
    const payload = "₹500 — सहकार";
    expect(await hmacHex(payload, "s")).toBe(reference(payload, "s"));
  });
});

describe("timingSafeEqualHex", () => {
  it("accepts two identical signatures", async () => {
    const sig = await hmacHex("order_abc|pay_1", "s");
    expect(timingSafeEqualHex(sig, reference("order_abc|pay_1", "s"))).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const sig = await hmacHex("order_abc|pay_1", "s");
    // Flip the first nibble — a valid-looking but wrong digest.
    const tampered = `${sig[0] === "a" ? "b" : "a"}${sig.slice(1)}`;
    expect(timingSafeEqualHex(sig, tampered)).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    expect(timingSafeEqualHex("abcd", "abcdef")).toBe(false);
    expect(timingSafeEqualHex("abcd", "")).toBe(false);
  });

  it("agrees with node:crypto on a full-length pair", async () => {
    const a = await hmacHex("x", "k");
    const b = await hmacHex("y", "k");
    const expected = nodeTimingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
    expect(timingSafeEqualHex(a, b)).toBe(expected);
  });
});
