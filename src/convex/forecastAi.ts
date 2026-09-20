"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SEASONS: Record<number, { season: string; outlook: string }> = {
  0: { season: "winter", outlook: "Cool, moderate demand for heating and indoor wiring" },
  1: { season: "late winter", outlook: "Pre-monsoon warm-up, rising appliance service demand" },
  2: { season: "spring", outlook: "Spring renovation season, high carpentry and painting demand" },
  3: { season: "pre-monsoon", outlook: "Pre-monsoon waterproofing and drainage peak" },
  4: { season: "early monsoon", outlook: "Monsoon onset — emergency electrical and seepage surge" },
  5: { season: "monsoon", outlook: "Heavy monsoon — plumbing blockages, short circuits, dampness fixes" },
  6: { season: "monsoon", outlook: "Peak monsoon — emergency dispatches dominate, supply strained" },
  7: { season: "late monsoon", outlook: "Monsoon tapering — seepage repair and electrical restoration" },
  8: { season: "post-monsoon", outlook: "Post-monsoon repair season, renovation demand rebounds" },
  9: { season: "festive", outlook: "Festive season (Diwali prep) — painting, carpentry, electrical peaks" },
  10: { season: "festive", outlook: "Festive season (Diwali/Pongal) — all trades at maximum demand" },
  11: { season: "winter", outlook: "Winter onset — heating repair and indoor work moderate" },
};

const FESTIVALS: Record<number, string> = {
  // Approximate lunar months — rough administrative estimate
  1: "Makar Sankranti / Pongal",
  3: "Ugadi / Gudi Padwa",
  7: "Onam",
  9: "Navratri / Dussehra",
  10: "Diwali / Deepavali",
  11: "Christmas / year-end demand",
};

function getSeasonalContext(): string {
  const now = new Date();
  const month = now.getMonth();
  const s = SEASONS[month];
  const festival = FESTIVALS[month] ? ` Upcoming/notable festival: ${FESTIVALS[month]}.` : "";
  return `${s.outlook}. Season: ${s.season}.${festival} District: Telangana (default federation region).`;
}

const FORECAST_SCHEMA = {
  type: "object",
  properties: {
    demandIndex: { type: "number", description: "Overall demand pressure 1-100" },
    primaryDeficitTrades: {
      type: "array",
      items: { type: "string" },
      description: "Trades with severe artisan shortages",
    },
    priceRecommendation: {
      type: "string",
      description: "Fair wage floor recommendation per day in INR preventing gouging while ensuring living wages",
    },
    welfarePoolAllocation: {
      type: "number",
      description: "Suggested welfare reserve allocation percentage (5-15%)",
    },
    actionableAdvisories: {
      type: "array",
      items: { type: "string" },
      description: "3 concise tactical recommendations for society branch managers",
    },
    summary: { type: "string", description: "One-paragraph executive summary for the federation dashboard" },
  },
  required: [
    "demandIndex",
    "primaryDeficitTrades",
    "priceRecommendation",
    "welfarePoolAllocation",
    "actionableAdvisories",
    "summary",
  ],
};

const STABILIZATION_SCHEMA = {
  type: "object",
  properties: {
    demandIndex: { type: "number", description: "Stability index 1-100 (100 = fully stable pricing)" },
    primaryDeficitTrades: {
      type: "array",
      items: { type: "string" },
      description: "Trades with price volatility or shortage risk",
    },
    priceRecommendation: {
      type: "string",
      description: "Fair-pricing stabilization recommendation: floor wages + surge caps per trade",
    },
    welfarePoolAllocation: {
      type: "number",
      description: "Recommended welfare reserve percentage for stabilization fund",
    },
    actionableAdvisories: {
      type: "array",
      items: { type: "string" },
      description: "3 concise stabilization recommendations for society managers",
    },
    summary: { type: "string", description: "Stabilization executive summary" },
  },
  required: [
    "demandIndex",
    "primaryDeficitTrades",
    "priceRecommendation",
    "welfarePoolAllocation",
    "actionableAdvisories",
    "summary",
  ],
};

function heuristicForecast(
  ctx: any,
  context: any,
  kind: string,
): any {
  const perTrade = context.perTrade as Record<string, any>;
  const deficitTrades: string[] = [];
  let maxRatio = 0;
  for (const [trade, data] of Object.entries(perTrade)) {
    const ratio = data.unserviced / Math.max(data.artisans, 1);
    if (ratio > maxRatio) maxRatio = ratio;
    if (data.unserviced > data.artisans * 0.8) deficitTrades.push(trade);
  }
  const demandIndex = Math.min(100, Math.round(30 + maxRatio * 50));
  const welfareAlloc = Math.min(15, Math.max(5, Math.round(5 + demandIndex * 0.08)));

  const advisories: string[] = [];
  if (deficitTrades.length > 0) {
    advisories.push(
      `Urgent: Request additional artisans in ${deficitTrades.join(", ")} from neighbouring districts.`,
    );
  } else {
    advisories.push("Supply meets current demand across all trades — maintain readiness posture.");
  }
  advisories.push(
    `Monitor welfare pool contribution rate; current accrual suggests ${welfareAlloc}% reserve allocation.`,
  );
  advisories.push(
    kind === "stabilization"
      ? "Review union base rates quarterly to prevent below-living-wage drift."
      : "Alert branch managers about seasonal surge in the next 48 hours.",
  );

  const summary =
    kind === "stabilization"
      ? `Heuristic stabilization analysis: demand stability at ${demandIndex}/100. ${
          deficitTrades.length > 0
            ? `Price pressure in ${deficitTrades.join(", ")}.`
            : "Pricing stable across all trades."
        } Recommended welfare reserve: ${welfareAlloc}%.`
      : `Heuristic demand forecast: pressure index ${demandIndex}/100. ${
          deficitTrades.length > 0
            ? `Severe shortage in ${deficitTrades.join(", ")}.`
            : "No critical shortages detected."
        } Seasonal outlook: ${getSeasonalContext().split(".")[0]}.`;

  return {
    demandIndex,
    primaryDeficitTrades: deficitTrades,
    priceRecommendation:
      kind === "stabilization"
        ? `Floor wage ₹750–900/day; surge cap 120% of base during emergency dispatch.`
        : `Maintain union base rates ₹750–900/day depending on trade complexity.`,
    welfarePoolAllocation: welfareAlloc,
    actionableAdvisories: advisories,
    summary,
  };
}

function buildPrompt(kind: string, context: any, season: string): string {
  const tradeSummary = Object.entries(context.perTrade)
    .map(([t, d]: [string, any]) => `  ${t}: ${d.artisans} artisans (${d.online} online, ${d.verified} verified), ${d.unserviced} unserviced bookings, ${d.booked24h} new in 24h`)
    .join("\n");

  return kind === "stabilization"
    ? `You are the Chief Labor Economist for the Sahakar Seva Cooperative Worker Federation.

Analyze the following district operational telemetry and generate fair-pricing stabilization recommendations:

District operational summary:
- Total artisans: ${context.totalBookings > 0 ? context.totalBookings : "data loading"}
- Total unserviced active bookings: ${context.totalUnserviced}
- Active cooperative societies: ${context.societiesActive}
- Welfare pool accrued: ₹${context.welfarePoolAccrued.toLocaleString("en-IN")}

Per-trade supply and demand:
${tradeSummary}

Seasonal & market context: ${season}

Generate a structured JSON response with:
1. "demandIndex": a stability score from 1-100 (100 = fully stable pricing, low supply pressure)
2. "primaryDeficitTrades": array of trades with price volatility or shortage-driven surge risk
3. "priceRecommendation": fair-pricing stabilization recommendation — set floor wages that ensure living wages plus surge caps to prevent gouging during emergency dispatches
4. "welfarePoolAllocation": recommended welfare reserve percentage for the stabilization fund (5-15%)
5. "actionableAdvisories": 3 concise stabilization recommendations for society branch managers
6. "summary": one-paragraph executive summary for the federation dashboard`
    : `You are the Chief Labor Economist for the Sahakar Seva Cooperative Worker Federation.

Analyze the following district operational telemetry and generate a demand forecast:

District operational summary:
- Total artisans: ${context.totalBookings > 0 ? context.totalBookings : "data loading"}
- Total unserviced active bookings: ${context.totalUnserviced}
- Total bookings (all time): ${context.totalBookings}
- Active cooperative societies: ${context.societiesActive}
- Welfare pool accrued: ₹${context.welfarePoolAccrued.toLocaleString("en-IN")}

Per-trade supply and demand:
${tradeSummary}

Seasonal & meteorological context: ${season}

Generate a structured JSON response with:
1. "demandIndex": overall demand pressure from 1 to 100 (100 = extreme pressure, supply critically strained)
2. "primaryDeficitTrades": array of trade names with severe artisan shortages
3. "priceRecommendation": fair wage floor recommendation in INR per day — prevent customer gouging while ensuring living wages for artisans
4. "welfarePoolAllocation": suggested welfare reserve allocation percentage (5-15%)
5. "actionableAdvisories": 3 concise tactical recommendations for society branch managers
6. "summary": one-paragraph executive summary for the federation dashboard`;
}

export const runForecast = action({
  args: {
    kind: v.optional(v.union(v.literal("forecast"), v.literal("stabilization"))),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const isAdmin = await ctx.runQuery(api.admin.amAdmin, {});
    if (!isAdmin) throw new Error("Forbidden");

    const context = await ctx.runQuery(api.gis.forecastContext, {});
    const season = getSeasonalContext();
    const kind = args.kind ?? "forecast";
    const prompt = buildPrompt(kind, context, season);

    // Determine the API key — support both env var names
    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? null;

    let result: any;
    let source = "gemini";
    let modelId: string | undefined;

    if (!apiKey) {
      // Heuristic fallback — works without any API key
      result = heuristicForecast(ctx, context, kind);
      source = "heuristic";
    } else {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });

        modelId = "gemini-2.5-flash";
        const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: kind === "stabilization" ? STABILIZATION_SCHEMA : FORECAST_SCHEMA,
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        });

        const text = response.text ?? "{}";
        result = JSON.parse(text);
      } catch (err: any) {
        console.error("Gemini forecast failed, falling back to heuristic:", err);
        result = heuristicForecast(ctx, context, kind);
        source = "heuristic";
      }
    }

    // Clamp values
    result.demandIndex = Math.max(1, Math.min(100, Math.round(result.demandIndex)));
    result.welfarePoolAllocation = Math.max(5, Math.min(15, Math.round(result.welfarePoolAllocation)));
    if (!Array.isArray(result.primaryDeficitTrades)) result.primaryDeficitTrades = [];
    if (!Array.isArray(result.actionableAdvisories)) result.actionableAdvisories = [];

    // Persist the snapshot
    const id = await ctx.runMutation(api.forecasts.save, {
      kind,
      district: "all",
      demandIndex: result.demandIndex,
      primaryDeficitTrades: result.primaryDeficitTrades,
      priceRecommendation: String(result.priceRecommendation),
      welfarePoolAllocation: result.welfarePoolAllocation,
      advisories: result.actionableAdvisories,
      summary: result.summary ? String(result.summary) : undefined,
      source,
      model: source === "gemini" ? modelId : undefined,
      context: JSON.stringify(context),
    });

    return { ...result, id, source, model: modelId };
  },
});
