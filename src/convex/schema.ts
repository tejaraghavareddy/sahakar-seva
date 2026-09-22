import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
      district: v.string(),
      state: v.string(),
      societyId: v.string(),
      experienceYears: v.number(),
      dailyRate: v.number(), // union standard base day rate (INR)
      upiVpa: v.optional(v.string()), // zero-commission direct settlement VPA

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

    // Customer bookings — full lifecycle dispatch
    bookings: defineTable({
      customerId: v.id("users"),
      serviceId: v.string(),
      trade: v.string(),
      serviceName: v.string(), // denormalized for listings
      address: v.string(),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      scheduledFor: v.number(),
      urgent: v.boolean(),
      notes: v.optional(v.string()),
      welfareOptIn: v.boolean(),
      base: v.number(),
      hourly: v.number(),
      welfareAmt: v.number(), // 7% welfare share (ledger)
      opsAmt: v.number(), // 3% operational cost share (ledger)
      workerShare: v.number(), // 90% worker payout
      total: v.number(),
      status: v.string(), // pending|accepted|enroute|inprogress|payment|completed|settled|cancelled
      workerId: v.optional(v.id("artisans")), // assigned on accept
      workerUserId: v.optional(v.id("users")),
      workerVpa: v.optional(v.string()), // worker's own UPI id — funds go straight to them
      acceptedAt: v.optional(v.number()),
      utr: v.optional(v.string()), // UPI transaction reference
      paidAt: v.optional(v.number()),
      settledAt: v.optional(v.number()),
      cancelledAt: v.optional(v.number()),
      cancelBy: v.optional(v.string()), // "customer" | "worker" | "admin"
      createdAt: v.number(),
    })
      .index("by_customer", ["customerId"])
      .index("by_worker", ["workerUserId"])
      .index("by_status", ["status"])
      .index("by_created", ["createdAt"]),

    // District cooperative societies — formal registration pipeline
    societies: defineTable({
      name: v.string(),
      district: v.string(),
      state: v.string(),
      code: v.string(), // e.g. TS-HYD-13 (state-district-seq)
      registrationNo: v.string(), // SSC/REG/YYYY/NNN charter reference
      jurisdiction: v.optional(v.string()), // mandals / neighborhoods covered
      lat: v.optional(v.number()), // HQ coordinates
      lng: v.optional(v.number()),
      address: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      status: v.string(), // pending | active | suspended | rejected
      reviewNote: v.optional(v.string()),
      registeredBy: v.id("users"),
      reviewedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_state", ["state"]),

    // Gemini-driven demand forecasts & fair-pricing stabilization snapshots
    forecasts: defineTable({
      kind: v.string(), // "forecast" | "stabilization"
      district: v.string(),
      demandIndex: v.number(), // 1..100
      primaryDeficitTrades: v.array(v.string()),
      priceRecommendation: v.string(),
      welfarePoolAllocation: v.number(), // suggested % of welfare reserve
      advisories: v.array(v.string()), // tactical advisories for branch managers
      summary: v.optional(v.string()),
      source: v.string(), // "gemini" | "heuristic"
      model: v.optional(v.string()),
      context: v.optional(v.string()), // telemetry snapshot fed to the model
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_district", ["district"]),

    // In-booking chat between customer and worker
    messages: defineTable({
      bookingId: v.id("bookings"),
      senderId: v.id("users"),
      senderName: v.string(),
      senderRole: v.string(), // "customer" | "worker" | "admin"
      body: v.string(),
      at: v.number(),
    }).index("by_booking", ["bookingId"]),

    // Dispute arbitration — double-blind flags from customers and workers
    disputes: defineTable({
      bookingId: v.id("bookings"),
      raisedBy: v.id("users"),
      raisedByRole: v.string(), // "customer" | "worker"
      category: v.string(), // "late" | "quality" | "unsafe" | "payment" | "behavior" | "other"
      details: v.string(),
      status: v.string(), // open | resolved | dismissed | blacklisted
      resolution: v.optional(v.string()),
      resolvedBy: v.optional(v.id("users")),
      resolvedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_booking", ["bookingId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
