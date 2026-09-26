import { describe, expect, it } from "vitest";
import { matchTrade } from "@/lib/voiceIntents";
import { SCHEMES } from "@/convex/welfareSchemes";

describe("voice intents: spoken request → trade", () => {
  it("routes an obvious plumbing complaint to a plumber", () => {
    expect(matchTrade("the kitchen tap has been leaking since monday")?.trade).toBe(
      "plumber",
    );
  });

  it("routes an electrical complaint to an electrician", () => {
    expect(
      matchTrade("the main switch is sparking whenever i turn it on")?.trade,
    ).toBe("electrician");
  });

  it("routes an appliance complaint to the appliance trade", () => {
    expect(matchTrade("my washing machine will not spin")?.trade).toBe("appliance");
  });

  it("prefers the trade with the most keyword hits in a mixed sentence", () => {
    // Mentions a light and a fan: two electrician hints against one mason hint.
    const guess = matchTrade("the light above the wall switch and the fan are both dead");
    expect(guess?.trade).toBe("electrician");
    expect(guess?.hits).toBeGreaterThanOrEqual(2);
  });

  it("matches case-insensitively, as speech recognition transcribes", () => {
    expect(matchTrade("NEED A PLUMBER THE TOILET IS BLOCKED")?.trade).toBe(
      "plumber",
    );
  });

  it("returns null rather than guessing when nothing matches", () => {
    // A wrong guess is worse than none: it sends the household to the wrong
    // trade and teaches them to distrust the screen.
    expect(matchTrade("what is the weather like today")).toBeNull();
    expect(matchTrade("")).toBeNull();
  });

  it("is not fooled by an empty or whitespace transcript", () => {
    expect(matchTrade("   ")).toBeNull();
  });
});

describe("welfare schemes catalogue", () => {
  it("only links to official government portals over https", () => {
    for (const s of SCHEMES) {
      expect(s.url.startsWith("https://"), `${s.id} url`).toBe(true);
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("states eligibility criteria for every scheme", () => {
    for (const s of SCHEMES) {
      expect(s.criteria.length, `${s.id} criteria`).toBeGreaterThan(0);
      expect(s.benefit.length).toBeGreaterThan(0);
      expect(s.minAge).toBeGreaterThan(0);
    }
  });

  it("uses unique scheme ids", () => {
    const ids = SCHEMES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
