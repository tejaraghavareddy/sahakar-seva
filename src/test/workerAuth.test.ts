/**
 * Worker sign-in: phone number handling, the SMS throttle, and portal routing.
 *
 * These three cover the parts of the worker sign-in flow that can silently do
 * the wrong thing: a number that normalises differently between the send and
 * the verify step locks a worker out of their own account, an unthrottled SMS
 * endpoint bills the cooperative, and a mis-routed redirect drops a worker into
 * the customer portal.
 */
import { describe, expect, it } from "vitest";
import { normalisePhone } from "@/convex/auth/phoneOtp";
import { signInPathFor, isWorkerPath } from "@/lib/portal";
import { setupTest, api } from "./convexHarness";

describe("normalisePhone", () => {
  it("accepts every way an Indian worker types their own number", () => {
    // These must all collapse to one value, because the code is verified
    // against the identifier used to request it.
    const expected = "+919876543210";
    expect(normalisePhone("9876543210")).toBe(expected);
    expect(normalisePhone("09876543210")).toBe(expected);
    expect(normalisePhone("+91 98765 43210")).toBe(expected);
    expect(normalisePhone("+91-98765-43210")).toBe(expected);
    expect(normalisePhone("98765 43210")).toBe(expected);
  });

  it("does not treat a leading trunk zero as part of the subscriber number", () => {
    // "09876543210" and "9876543210" are the same person; a naive normaliser
    // would send them to two different accounts.
    expect(normalisePhone("09876543210")).toBe(normalisePhone("9876543210"));
  });

  it("preserves an already-international number", () => {
    expect(normalisePhone("+919876543210")).toBe("+919876543210");
  });

  it("rejects a number that is too short to be a mobile", () => {
    expect(() => normalisePhone("12345")).toThrow(/valid mobile number/i);
  });

  it("rejects an empty or junk value", () => {
    expect(() => normalisePhone("")).toThrow(/valid mobile number/i);
    expect(() => normalisePhone("not a phone")).toThrow(/valid mobile number/i);
  });
});

describe("authThrottle.requestPhoneOtp", () => {
  it("spends one budget per normalised number, not per spelling", async () => {
    // A caller must not get a fresh allowance by re-spelling the number, which
    // is the obvious way to bypass a per-number SMS limit.
    const t = setupTest();
    const forms = [
      "9876543210",
      "09876543210",
      "+91 98765 43210",
      "98765 43210",
      "+919876543210",
    ];
    for (const phone of forms) {
      await t.mutation(api.authThrottle.requestPhoneOtp, { phone });
    }
    // The OTP budget is 5 per 15 minutes; the sixth request in any spelling
    // must be refused.
    await expect(
      t.mutation(api.authThrottle.requestPhoneOtp, { phone: "9876543210" }),
    ).rejects.toThrow();
  });

  it("rejects a malformed number before spending any budget", async () => {
    const t = setupTest();
    await expect(
      t.mutation(api.authThrottle.requestPhoneOtp, { phone: "abc" }),
    ).rejects.toThrow(/valid mobile number/i);

    // A rejected call must not have consumed the real number's allowance.
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.authThrottle.requestPhoneOtp, { phone: "9876543210" });
    }
    await expect(
      t.mutation(api.authThrottle.requestPhoneOtp, { phone: "9876543210" }),
    ).rejects.toThrow();
  });

  it("returns the normalised number so the caller signs in with the same string", async () => {
    const t = setupTest();
    const res = await t.mutation(api.authThrottle.requestPhoneOtp, {
      phone: "098765 43210",
    });
    expect(res.phone).toBe("+919876543210");
  });

  it("gives a different number its own budget", async () => {
    const t = setupTest();
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.authThrottle.requestPhoneOtp, { phone: "9876543210" });
    }
    // One worker hitting their limit must not lock out every other worker.
    await expect(
      t.mutation(api.authThrottle.requestPhoneOtp, { phone: "9000000001" }),
    ).resolves.toEqual({ ok: true, phone: "+919000000001" });
  });
});

describe("portal routing", () => {
  it("sends a worker to the worker sign-in", () => {
    // This is the bug the mapping exists to fix: a worker deep-linking to the
    // hub used to be redirected to the generic screen, and a worker signing
    // out used to be dropped into the customer catalog.
    expect(signInPathFor("/dashboard")).toBe("/login/worker");
    expect(signInPathFor("/onboarding")).toBe("/login/worker");
    expect(signInPathFor("/welfare")).toBe("/login/worker");
  });

  it("sends a customer to the customer sign-in", () => {
    expect(signInPathFor("/services")).toBe("/login/customer");
    expect(signInPathFor("/book/abc")).toBe("/login/customer");
    expect(signInPathFor("/bookings")).toBe("/login/customer");
    expect(signInPathFor("/bookings/xyz")).toBe("/login/customer");
  });

  it("keeps the admin and platform consoles on the generic screen", () => {
    // Their consoles open their own clearance modal, which the generic screen
    // carries shortcuts for.
    expect(signInPathFor("/admin")).toBe("/auth");
    expect(signInPathFor("/super")).toBe("/auth");
  });

  it("does not match a path that merely shares a prefix", () => {
    // "/servicesx" and "/dashboard-old" are not the customer or worker portal.
    // A prefix match without the boundary would send them to the wrong screen.
    expect(signInPathFor("/servicesx")).toBe("/auth");
    expect(signInPathFor("/dashboard-old")).toBe("/auth");
    expect(signInPathFor("/booking")).toBe("/auth");
  });

  it("identifies worker paths", () => {
    expect(isWorkerPath("/dashboard")).toBe(true);
    expect(isWorkerPath("/services")).toBe(false);
    expect(isWorkerPath("/")).toBe(false);
  });
});
