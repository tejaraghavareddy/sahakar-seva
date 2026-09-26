import { TRADES, type TradeId } from "./trades";

/**
 * Turning a spoken household complaint into a trade.
 *
 * Someone reporting a problem rarely says the trade's name. They say "the
 * bathroom tap has been leaking since Tuesday" or "the main switch is
 * sparking". The service catalog is organised by trade, so something has to
 * bridge that gap or the voice path is a novelty rather than a feature.
 *
 * The vocabulary below is deliberately small and readable. It is a keyword
 * matcher, not a language model: a wrong guess is worse than no guess, because
 * a household that is told their leaking tap is a "custom masonry job" stops
 * trusting the whole screen. When nothing matches, the caller keeps the raw
 * transcript as the description and lets the human pick the category.
 */

const TRADE_HINTS: Record<TradeId, string[]> = {
  electrician: [
    "light",
    "fan",
    "switch",
    "socket",
    "wire",
    "power",
    "short circuit",
    "spark",
    "mcb",
    "electric",
  ],
  plumber: [
    "tap",
    "faucet",
    "leak",
    "water",
    "drain",
    "blocked",
    "clog",
    "pipe",
    "flush",
    "toilet",
    "plumb",
  ],
  carpenter: [
    "door",
    "lock",
    "window",
    "furniture",
    "sofa",
    "chair",
    "fitting",
    "modular",
    "wood",
  ],
  mason: ["wall", "crack", "seepage", "damp", "tile", "plaster", "brick"],
  painter: ["paint", "repaint", "texture", "coat", "color", "colour"],
  appliance: [
    "ac",
    "air conditioner",
    "fridge",
    "refrigerator",
    "washing machine",
    "washer",
    "microwave",
    "oven",
    "heater",
    "geyser",
  ],
};

export interface VoiceMatch {
  trade: TradeId;
  /** Keyword hits behind the guess. More hits means a firmer match. */
  hits: number;
}

/**
 * Guess which trade a transcript is about, or null when nothing matches.
 *
 * The trade with the most keyword hits wins, which is what makes a sentence
 * like "the light in the bathroom flickers and the fan is broken" land on the
 * electrician rather than on whichever hint happens to appear first.
 */
export function matchTrade(transcript: string): VoiceMatch | null {
  const text = transcript.toLowerCase();
  let best: VoiceMatch | null = null;
  for (const trade of TRADES) {
    let hits = 0;
    for (const hint of TRADE_HINTS[trade.id]) {
      if (text.includes(hint)) hits += 1;
    }
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { trade: trade.id, hits };
    }
  }
  return best;
}
