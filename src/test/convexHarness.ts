/**
 * Shared convex-test harness for the Sahakar Seva backend.
 *
 * Every Convex function in this project resolves the caller through
 * `getAuthUserId(ctx)`, which is just `identity.subject` split on "|".
 * That means `t.withIdentity({ subject: <usersId> })` gives us a fully
 * authenticated, seeded context — customer, worker and admin alike.
 */
import { convexTest } from "convex-test";
import schema from "@/convex/schema";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// convex-test wants the module map from a glob in the functions directory.
const modules = import.meta.glob("../convex/**/*.{ts,tsx}");

export function setupTest() {
  return convexTest(schema, modules);
}

export type T = ReturnType<typeof setupTest>;

/** Narrow a possibly-missing row to a definitely-present one, with a useful failure. */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Test setup failed: expected ${what} to exist`);
  }
  return value;
}

const OWNER_EMAIL = "teja200822@gmail.com";

/** Insert a bare `users` row and return its id. */
export async function seedUser(
  t: T,
  fields: Partial<Doc<"users">> = {},
): Promise<Id<"users">> {
  return t.run(async (ctx) => ctx.db.insert("users", fields));
}

/** A signed-in member account (customer). */
export async function seedCustomer(t: T, fields: Partial<Doc<"users">> = {}) {
  const id = await seedUser(t, {
    email: "customer@example.com",
    name: "Test Customer",
    role: "user",
    ...fields,
  });
  return { id, as: t.withIdentity({ subject: id }) };
}

/** A signed-in member account (worker/artisan). */
export async function seedWorker(t: T, fields: Partial<Doc<"users">> = {}) {
  const id = await seedUser(t, {
    email: "worker@example.com",
    name: "Test Worker",
    role: "user",
    ...fields,
  });
  return { id, as: t.withIdentity({ subject: id }) };
}

/** An account the backend treats as federation admin. */
export async function seedAdmin(t: T, fields: Partial<Doc<"users">> = {}) {
  const id = await seedUser(t, {
    email: "board@sahakar.demo",
    name: "Board Member",
    role: "admin",
    ...fields,
  });
  return { id, as: t.withIdentity({ subject: id }) };
}

/** The hard-coded owner email that is always treated as admin. */
export async function seedOwner(t: T) {
  const id = await seedUser(t, { email: OWNER_EMAIL, name: "Owner" });
  return { id, as: t.withIdentity({ subject: id }) };
}

export async function seedArtisan(
  t: T,
  userId: Id<"users">,
  fields: Partial<Doc<"artisans">> = {},
): Promise<Id<"artisans">> {
  return t.run(async (ctx) =>
    ctx.db.insert("artisans", {
      userId,
      fullName: "Test Worker",
      phone: "9000000000",
      trade: "electrician",
      district: "Kurnool",
      state: "Andhra Pradesh",
      societyId: "self",
      experienceYears: 5,
      dailyRate: 800,
      idType: "aadhaar",
      idLast4: "1234",
      kycStatus: "verified",
      quizPassed: true,
      isOnline: true,
      lat: 15.83,
      lng: 78.03,
      welfareBalance: 0,
      dividendBalance: 0,
      createdAt: Date.now(),
      ...fields,
    }),
  );
}

export async function seedBooking(
  t: T,
  customerId: Id<"users">,
  fields: Partial<Doc<"bookings">> = {},
): Promise<Id<"bookings">> {
  return t.run(async (ctx) =>
    ctx.db.insert("bookings", {
      customerId,
      serviceId: "ap-ac",
      trade: "appliance",
      serviceName: "AC Repair",
      address: "1 Test Street",
      lat: 15.83,
      lng: 78.03,
      scheduledFor: Date.now() + 3600_000,
      urgent: false,
      welfareOptIn: true,
      base: 1000,
      hourly: 0,
      welfareAmt: 70,
      opsAmt: 30,
      workerShare: 900,
      total: 1000,
      status: "pending",
      createdAt: Date.now(),
      ...fields,
    }),
  );
}

export { api };
export type { Doc, Id };
