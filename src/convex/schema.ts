import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // add other tables here

    // Sahakar Seva v1 — artisan profiles, verification state and live telemetry
    artisans: defineTable({
      userId: v.id("users"), // owner of this artisan record

      // STEP 1 — Trade profile
      fullName: v.string(),
      phone: v.string(),
      trade: v.string(), // trade id, see src/lib/trades.ts
      district: v.string(), // e.g. "Hyderabad"
      state: v.string(),
      societyId: v.string(), // e.g. "hyd-cec"
      experienceYears: v.number(),
      dailyRate: v.number(), // union standard base day rate (INR)

      // STEP 2 — Identity & police clearance (KYC)
      idType: v.string(), // "aadhaar" | "voter"
      idLast4: v.string(),
      kycStatus: v.string(), // "pending" | "verified" | "rejected"
      kycVerifiedAt: v.optional(v.number()),
      kycRef: v.optional(v.string()), // background verification reference

      // STEP 3 — Voice skill quiz -> digital cooperative trade credential
      quizPassed: v.boolean(),
      quizScore: v.optional(v.number()), // 0..100
      quizTakenAt: v.optional(v.number()),
      credentialId: v.optional(v.string()), // SSC-YYYY-XXXX
      credentialIssuedAt: v.optional(v.number()),

      // STEP 4 — operational state
      isOnline: v.boolean(),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      telemetryAt: v.optional(v.number()), // last GPS ping

      // cooperative ledger (v1 display only)
      welfareBalance: v.number(),
      dividendBalance: v.number(),

      createdAt: v.number(),
    })
      .index("by_userId", ["userId"])
      .index("by_trade", ["trade"])
      .index("by_kyc", ["kycStatus"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
