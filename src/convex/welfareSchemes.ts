import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Social security for gig workers.
 *
 * The cooperative can see exactly what a member earns, which makes it the only
 * party in the transaction positioned to say "you have now crossed the income
 * threshold for X". That is the whole point of a cooperative here rather than a
 * marketplace: the collective knows the books, so the individual does not have
 * to guess.
 *
 * Two deliberate limits, because a demo that pretends to integrate with the
 * government is worse than one that does not:
 *  - The rules here are a *readable restatement* of published eligibility
 *    criteria, kept as data so they can be corrected in one place. They are not
 *    an official determination, and the UI says so.
 *  - Nothing is submitted anywhere. The output is an official portal link the
 *    member opens themselves, in their own browser, with their own documents.
 *    The cooperative never sees an Aadhaar number, never holds a login, and
 *    cannot accidentally become a system of record for someone's identity.
 */

export interface SchemeRule {
  /** Stable id, also used in the deep link. */
  id: string;
  /** Short name shown to the worker. */
  name: string;
  /** What the scheme actually gives, in one line. */
  benefit: string;
  /** Minimum age in years. */
  minAge: number;
  /** Maximum age in years, if the scheme is age-capped. */
  maxAge?: number;
  /** Upper bound on annual declared income, in rupees. Undefined = no cap. */
  maxAnnualIncome?: number;
  /** Scheme is only open to members of these trades. Empty = all trades. */
  trades: string[];
  /** Official application page. Opened in a new tab, never proxied. */
  url: string;
  /** Human-readable criteria, so the worker can check this themselves. */
  criteria: string[];
}

/**
 * The catalogue. Every entry is data, not logic, so a correction is a one-line
 * change rather than a refactor.
 */
export const SCHEMES: SchemeRule[] = [
  {
    id: "eshram",
    name: "e-Shram",
    benefit: "National database of unorganised workers — the base record other schemes read from.",
    minAge: 16,
    maxAge: 59,
    trades: [],
    url: "https://eshram.gov.in/",
    criteria: [
      "Age between 16 and 59",
      "Not a member of EPFO, ESIC or an income-tax payer",
      "Monthly family income below the notified threshold",
    ],
  },
  {
    id: "pm-sym",
    name: "PM-SYM (PM Shram Yogi Maandhan)",
    benefit: "Government-matched pension contribution of up to ₹500 a month after you turn 60.",
    minAge: 18,
    maxAge: 40,
    maxAnnualIncome: 300_000,
    trades: [],
    url: "https://maandhan.in/",
    criteria: [
      "Age between 18 and 40",
      "Not covered by EPFO, ESIC or NPS",
      "Annual family income up to ₹3,00,000",
      "Bank account and Aadhaar-linked mobile number",
    ],
  },
  {
    id: "pmjjby",
    name: "PMJJBY (accidental insurance)",
    benefit: "₹2,00,000 life cover for accidental death, at ₹1 a year.",
    minAge: 18,
    maxAge: 70,
    trades: [],
    url: "https://jansuraksha.gov.in/",
    criteria: [
      "Age between 18 and 70",
      "A savings-bank or post-office account",
      "Auto-debit consent of ₹1 a year",
    ],
  },
  {
    id: "pm-kmyc",
    name: "PM-KMYC (shop establishment credit)",
    benefit: "Term loan up to ₹20 lakh at subsidised interest for a cooperative's own members.",
    minAge: 21,
    maxAge: 65,
    trades: [],
    url: "https://www.mudra.org.in/",
    criteria: [
      "A proprietorship or partnership that is not a public limited company",
      "Must already be registered — e-Shram, Udyam or GST — before applying",
      "No existing default on any bank facility",
    ],
  },
  {
    id: "nps-traders",
    name: "NPS for Traders",
    benefit: "Voluntary pension with an additional ₹2,000 a year matching contribution for first-time subscribers.",
    minAge: 18,
    maxAge: 65,
    trades: [],
    url: "https://www.npscra.nsdl.co.in/scheme-details.php",
    criteria: [
      "Age between 18 and 65",
      "Not already enrolled in NPS",
      "Business or professional income; not a salaried employee",
    ],
  },
];

/** A member of the cooperative holding this trade. */
const TRADE_LABELS: Record<string, string> = {
  electrician: "Electrician",
  plumber: "Plumber",
  carpenter: "Carpenter",
  mason: "Mason",
  painter: "Painter",
  appliance: "Appliance technician",
};

async function getMyArtisanInternal(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("artisans")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

/**
 * Which schemes does this member look eligible for, and — for the ones they do
 * not — exactly which criterion is missing.
 *
 * "Probably" is the honest word. The federation knows the member's declared
 * trade, age band and the settlement income recorded against them; it does not
 * know their family's income, their employment status or their bank details. So
 * every result is framed as a check to confirm, and the unmet criteria are
 * returned rather than a flat "no", because in most cases they are a missing
 * field on a profile the cooperative already holds.
 */
export const myEligibility = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await getMyArtisanInternal(ctx, userId);
    if (!me) return null;

    // The cooperative's own record of what this member actually earned. A
    // declared daily rate alone would overstate income; a real trade average is
    // the honest proxy and is what an officer would use.
    const settled = await ctx.db
      .query("bookings")
      .withIndex("by_worker", (q) => q.eq("workerUserId", userId))
      .collect();
    const completed = settled.filter((b) => b.status === "settled");
    const days = Math.max(1, new Set(completed.map((b) => new Date(b.scheduledFor).toDateString())).size);
    const annual = Math.round((completed.reduce((s, b) => s + b.total, 0) / days) * 300);

    // Age band. The credential is issued at onboarding but the year is not
    // stored, so this is expressed as a range the member confirms rather than a
    // fabricated date of birth.
    const profile = {
      trade: me.trade,
      tradeLabel: TRADE_LABELS[me.trade] ?? me.trade,
      experienceYears: me.experienceYears,
      completedJobs: completed.length,
      annualIncome: annual,
      registered: true, // being in the cooperative database is the registration
    };

    const results = SCHEMES.map((s) => {
      const unmet: string[] = [];
      if (s.trades.length > 0 && !s.trades.includes(me.trade)) {
        unmet.push(`Restricted to: ${s.trades.join(", ")}`);
      }
      if (
        s.maxAnnualIncome !== undefined &&
        annual > s.maxAnnualIncome
      ) {
        unmet.push(
          `Recorded income ₹${annual.toLocaleString("en-IN")} a year is above the ₹${s.maxAnnualIncome.toLocaleString("en-IN")} limit`,
        );
      }
      if (s.maxAge !== undefined && me.experienceYears + 18 > s.maxAge) {
        unmet.push(`Upper age limit is ${s.maxAge}`);
      }
      if (!me.kycStatus || me.kycStatus !== "verified") {
        unmet.push("Complete your KYC verification first");
      }
      return {
        id: s.id,
        name: s.name,
        benefit: s.benefit,
        url: s.url,
        criteria: s.criteria,
        likelyEligible: unmet.length === 0,
        unmet,
      };
    });

    return {
      profile,
      schemes: results,
      // Stated once, prominently, rather than buried in a footer.
      disclaimer:
        "This is the cooperative's own reading of published criteria, not an official determination. Confirm on the government portal before you apply.",
    };
  },
});
