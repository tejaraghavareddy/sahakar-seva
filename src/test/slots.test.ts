import { describe, expect, it } from "vitest";
import {
  SLOT_PARTS,
  SLOT_DAYS,
  countSlots,
  dayOffset,
  isSlotSet,
  partOfDay,
  partsForDay,
  slotBit,
  withSlot,
} from "@/lib/slots";
import {
  setupTest,
  must,
  api,
  seedWorker,
  seedArtisan,
  seedCustomer,
  seedBooking,
} from "./convexHarness";

describe("availability slots: bitmask model", () => {
  it("maps a day and part of day onto a distinct bit", () => {
    const bits = new Set<number>();
    for (let day = 0; day < SLOT_DAYS; day++) {
      for (const part of SLOT_PARTS) bits.add(slotBit(day, part));
    }
    expect(bits.size).toBe(SLOT_DAYS * SLOT_PARTS.length);
  });

  it("round-trips a set and a cleared slot", () => {
    let mask = 0;
    mask = withSlot(mask, 2, "evening", true);
    expect(isSlotSet(mask, 2, "evening")).toBe(true);
    expect(isSlotSet(mask, 2, "morning")).toBe(false);

    mask = withSlot(mask, 2, "evening", false);
    expect(isSlotSet(mask, 2, "evening")).toBe(false);
    expect(countSlots(mask)).toBe(0);
  });

  it("treats an unset mask as fully unavailable rather than fully open", () => {
    // The wrong default here would advertise every worker as available all day.
    expect(isSlotSet(undefined, 0, "morning")).toBe(false);
    expect(countSlots(undefined)).toBe(0);
  });

  it("keeps days independent", () => {
    let mask = withSlot(0, 0, "morning", true);
    mask = withSlot(mask, 6, "evening", true);
    expect(isSlotSet(mask, 0, "morning")).toBe(true);
    expect(isSlotSet(mask, 1, "morning")).toBe(false);
    expect(isSlotSet(mask, 6, "evening")).toBe(true);
    expect(countSlots(mask)).toBe(2);
  });

  it("lists the open parts of a day", () => {
    let mask = withSlot(0, 1, "morning", true);
    mask = withSlot(mask, 1, "evening", true);
    expect(partsForDay(mask, 1)).toEqual(["morning", "evening"]);
    expect(partsForDay(mask, 3)).toEqual([]);
  });

  it("classifies a timestamp into a part of the day", () => {
    expect(partOfDay(new Date("2026-01-05T08:00:00"))).toBe("morning");
    expect(partOfDay(new Date("2026-01-05T15:00:00"))).toBe("afternoon");
    expect(partOfDay(new Date("2026-01-05T20:00:00"))).toBe("evening");
  });

  it("clamps a day offset into the bookable week", () => {
    const today = new Date("2026-01-05T10:00:00");
    expect(dayOffset(new Date("2026-01-05T18:00:00"), today)).toBe(0);
    expect(dayOffset(new Date("2026-01-09T09:00:00"), today)).toBe(4);
    // Yesterday clamps to today rather than going negative.
    expect(dayOffset(new Date("2026-01-01T09:00:00"), today)).toBe(0);
    // And a date far out clamps to the last bookable day.
    expect(dayOffset(new Date("2026-06-01T09:00:00"), today)).toBe(SLOT_DAYS - 1);
  });
});

describe("availability slots: stored on the artisan", () => {
  it("toggles a slot on the signed-in worker's profile", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    const artisanId = await seedArtisan(t, w.id);

    await w.as.mutation(api.artisans.setSlots, {
      day: 3,
      part: "evening",
      on: true,
    });
    let a = must(await t.run((ctx) => ctx.db.get(artisanId)), "artisan");
    expect(isSlotSet(a.slots, 3, "evening")).toBe(true);
    expect(countSlots(a.slots)).toBe(1);

    await w.as.mutation(api.artisans.setSlots, {
      day: 3,
      part: "evening",
      on: false,
    });
    a = must(await t.run((ctx) => ctx.db.get(artisanId)), "artisan");
    expect(countSlots(a.slots)).toBe(0);
  });

  it("rejects an out-of-range day or part of day", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    await expect(
      w.as.mutation(api.artisans.setSlots, { day: 9, part: "morning", on: true }),
    ).rejects.toThrow(/Invalid day/);
    await expect(
      w.as.mutation(api.artisans.setSlots, { day: 1, part: "night", on: true }),
    ).rejects.toThrow(/Invalid part of day/);
  });

  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(
      t.mutation(api.artisans.setSlots, { day: 1, part: "morning", on: true }),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("surfaces the slots and the worker's years on the public directory", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, {
      trade: "plumber",
      experienceYears: 12,
      skillStatus: "verified",
    });
    await w.as.mutation(api.artisans.setSlots, {
      day: 2,
      part: "morning",
      on: true,
    });

    const list = await t.query(api.artisans.publicDirectory, { trade: "plumber" });
    expect(list).toHaveLength(1);
    expect(list[0].experienceYears).toBe(12);
    expect(isSlotSet(list[0].slots, 2, "morning")).toBe(true);
  });
});

describe("public worker directory", () => {
  it("only lists workers who could actually take the job", async () => {
    const t = setupTest();
    const good = await seedWorker(t, { email: "good@example.com" });
    await seedArtisan(t, good.id, { trade: "plumber" });
    // Verified identity but never passed the trade quiz.
    const unquized = await seedWorker(t, { email: "unquized@example.com" });
    await seedArtisan(t, unquized.id, { trade: "plumber", quizPassed: false });
    // Quiz passed but KYC still in review.
    const unverified = await seedWorker(t, { email: "unverified@example.com" });
    await seedArtisan(t, unverified.id, { trade: "plumber", kycStatus: "pending" });

    const list = await t.query(api.artisans.publicDirectory, { trade: "plumber" });
    expect(list).toHaveLength(1);
  });

  it("never leaks phone, UPI, document digits or live GPS", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, {
      fullName: "Asha",
      phone: "9876543210",
      upiVpa: "asha@upi",
      idLast4: "4321",
      welfareBalance: 700,
      lat: 15.83,
      lng: 78.03,
    });

    const list = await t.query(api.artisans.publicDirectory, {});
    const serialized = JSON.stringify(list);
    for (const secret of ["9876543210", "asha@upi", "4321", "700", "15.83"]) {
      expect(serialized, `leaked ${secret}`).not.toContain(secret);
    }
    // Name is a professional listing, not a secret.
    expect(list[0].fullName).toBe("Asha");
  });

  it("shows the same aggregate the customer's own review moved", async () => {
    const t = setupTest();
    const c = await seedCustomer(t, { email: "buyer@example.com" });
    const w = await seedWorker(t, { email: "plumber@example.com" });
    const artisanId = await seedArtisan(t, w.id, {
      trade: "plumber",
      skillStatus: "verified",
    });
    const bookingId = await seedBooking(t, c.id, {
      trade: "plumber",
      status: "completed",
      workerId: artisanId,
      workerUserId: w.id,
    });
    await c.as.mutation(api.reviews.submit, { bookingId, rating: 5 });

    const [profile] = await t.query(api.artisans.publicDirectory, {
      trade: "plumber",
    });
    expect(profile.ratingAvg).toBe(5);
    expect(profile.ratingCount).toBe(1);
    // And the completed job count is derived, not stored, so it cannot drift.
    expect(profile.completedJobs).toBe(1);
  });

  it("narrows to fully verified workers for a Safety Mode customer", async () => {
    const t = setupTest();
    const a = await seedWorker(t, { email: "a@example.com" });
    await seedArtisan(t, a.id, {
      trade: "plumber",
      skillStatus: "verified",
    });
    const b = await seedWorker(t, { email: "b@example.com" });
    await seedArtisan(t, b.id, { trade: "plumber", skillStatus: "pending" });

    const c = await seedCustomer(t, { email: "safety@example.com" });
    await t.run(async (ctx) => ctx.db.patch(c.id, { safetyMode: true }));
    const filtered = await c.as.query(api.artisans.publicDirectory, {
      trade: "plumber",
    });
    expect(filtered).toHaveLength(1);
  });

  it("returns the worker's published work on their profile", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    const artisanId = await seedArtisan(t, w.id, { trade: "plumber" });
    const profile = await t.query(api.artisans.profile, { id: artisanId });
    expect(profile).not.toBeNull();
    expect(profile!.listings).toEqual([]);
  });

  it("hides a removed worker entirely", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    const artisanId = await seedArtisan(t, w.id, { removedAt: Date.now() });
    expect(await t.query(api.artisans.publicDirectory, {})).toHaveLength(0);
    expect(await t.query(api.artisans.profile, { id: artisanId })).toBeNull();
  });
});
