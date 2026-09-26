"use node";

/**
 * Real weather and real festival dates for the demand forecast.
 *
 * The statement asks for prediction from "weather, holidays, seasons, and local
 * repair work". Seasons and local repair history were here from the start; the
 * weather was not, which made the forecast a dressed-up calendar lookup — and
 * the calendar is the weakest of the four inputs, because India runs on the
 * monsoon and nothing in a month index knows whether it rained.
 *
 * Open-Meteo is used because it needs no API key, no account and no billing
 * detail. That is a deliberate constraint for a hackathon prototype: a forecast
 * feature behind a credential nobody can obtain in the time available is a
 * feature that does not run.
 *
 * This is an action (not a query) because it performs network I/O, and it is
 * best-effort by design: if the upstream is slow or unreachable the caller gets
 * `null` and the forecast falls back to seasonal reasoning rather than failing.
 */

/** India-wide public holidays and the festivals that actually move demand. */
interface Festival {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  name: string;
  /**
   * How much the festival moves household repair demand, 1-5. Diwali is not a
   * holiday in the calendar sense; it is the single largest demand event of the
   * year for painting, carpentry and wiring.
   */
  weight: number;
}

/**
 * Festival and holiday dates, as data.
 *
 * Held here rather than fetched so the forecast is deterministic and testable.
 * Lunar-calendar dates shift each year, so this is maintained per year and the
 * obvious next improvement is an ICS or gazette feed. For a forecast that only
 * needs "is a big festival within two weeks", the precision is sufficient and
 * the absence of a dependency is worth more than exactness.
 */
const FESTIVALS_2026: Festival[] = [
  { date: "2026-01-01", name: "New Year's Day", weight: 1 },
  { date: "2026-01-26", name: "Republic Day", weight: 1 },
  { date: "2026-03-04", name: "Holi", weight: 2 },
  { date: "2026-04-14", name: "Ambedkar Jayanti", weight: 2 },
  { date: "2026-08-15", name: "Independence Day", weight: 1 },
  { date: "2026-08-27", name: "Ganesh Chaturthi", weight: 3 },
  { date: "2026-10-02", name: "Gandhi Jayanti", weight: 1 },
  { date: "2026-10-20", name: "Dussehra", weight: 3 },
  { date: "2026-11-08", name: "Diwali", weight: 5 },
  { date: "2026-11-24", name: "Guru Nanak Jayanti", weight: 2 },
  { date: "2026-12-25", name: "Christmas", weight: 2 },
];

const FESTIVALS_2027: Festival[] = [
  { date: "2027-01-01", name: "New Year's Day", weight: 1 },
  { date: "2027-01-26", name: "Republic Day", weight: 1 },
  { date: "2027-03-22", name: "Holi", weight: 2 },
  { date: "2027-08-15", name: "Independence Day", weight: 1 },
  { date: "2027-10-09", name: "Dussehra", weight: 3 },
  { date: "2027-10-29", name: "Diwali", weight: 5 },
  { date: "2027-12-25", name: "Christmas", weight: 2 },
];

const ALL_FESTIVALS = [...FESTIVALS_2026, ...FESTIVALS_2027].sort((a, b) =>
  a.date.localeCompare(b.date),
);

/** Federations default to Kurnool, Andhra Pradesh — the pilot district. */
const DEFAULT_LAT = 15.83;
const DEFAULT_LNG = 78.03;

export interface WeatherSnapshot {
  lat: number;
  lng: number;
  /** Current conditions at the district centroid. */
  now: {
    tempC: number;
    humidity: number;
    precipitationMm: number;
    windKph: number;
    code: number;
  };
  /** Seven-day totals, which is what actually moves repair demand. */
  week: {
    rainMm: number;
    maxTempC: number;
    minTempC: number;
    rainDays: number;
  };
  /** Plain-language read of what the rain is likely to do to demand. */
  implication: string;
}

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * Turn rainfall into a demand read.
 *
 * This is the whole reason the weather is fetched at all. Rain is not a small
 * adjustment to a forecast: standing water is the single largest driver of
 * emergency household calls in this trade, so the mapping is deliberately blunt
 * and legible rather than a learned curve nobody can defend on stage.
 */
export function demandFromRain(
  weekRainMm: number,
  rainDays: number,
): { index: number; implication: string } {
  if (weekRainMm >= 100 || rainDays >= 5) {
    return {
      index: 9,
      implication:
        "Heavy rainfall: expect blocked drains, roof leaks, seepage and damp-proofing. Plumbers, masons and painters should expect emergency-level calls for the whole week.",
    };
  }
  if (weekRainMm >= 50 || rainDays >= 3) {
    return {
      index: 6,
      implication:
        "Wet week: drainage clearing and hidden leak tracing will dominate, with a lag into seepage work the following week.",
    };
  }
  if (weekRainMm >= 10 || rainDays >= 1) {
    return {
      index: 3,
      implication:
        "Light rain: minor leak checks and gutter clearing. Mostly normal demand.",
    };
  }
  if (weekRainMm > 0) {
    return {
      index: 1,
      implication: "Trace rainfall only. No material change to demand.",
    };
  }
  return {
    index: 0,
    implication:
      "Dry week: no weather-driven uplift. Demand follows the season and the local repair book alone.",
  };
}

/** Festivals within the next `days` days, heaviest first. */
export function upcomingFestivals(
  from: Date = new Date(),
  days = 21,
): { name: string; date: string; inDays: number; weight: number }[] {
  const start = from.getTime();
  const end = start + days * 86_400_000;
  const out = [];
  for (const f of ALL_FESTIVALS) {
    const at = Date.parse(`${f.date}T00:00:00Z`);
    if (Number.isNaN(at)) continue;
    if (at >= start && at <= end) {
      out.push({
        name: f.name,
        date: f.date,
        inDays: Math.round((at - start) / 86_400_000),
        weight: f.weight,
      });
    }
  }
  return out.sort((a, b) => b.weight - a.weight || a.inDays - b.inDays);
}

/** One-line festival read for the forecast prompt. */
export function festivalLine(from: Date = new Date()): string {
  const soon = upcomingFestivals(from, 21);
  if (soon.length === 0) return "No major festival in the next three weeks.";
  return soon
    .map(
      (f) =>
        `${f.name} in ${f.inDays} day${f.inDays === 1 ? "" : "s"} (demand weight ${f.weight}/5)`,
    )
    .join("; ");
}

/**
 * Fetch a seven-day snapshot for a district.
 *
 * Returns null rather than throwing on any failure: a forecast that degrades to
 * seasonal reasoning is useful, one that errors out because a third party is
 * down is not.
 */
export async function fetchWeather(
  lat: number = DEFAULT_LAT,
  lng: number = DEFAULT_LNG,
): Promise<WeatherSnapshot | null> {
  const url =
    `${WEATHER_URL}?latitude=${lat}&longitude=${lng}` +
    "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code" +
    "&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_hours" +
    "&timezone=auto&forecast_days=7";

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        precipitation: number;
        wind_speed_10m: number;
        weather_code: number;
      };
      daily?: {
        precipitation_sum?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_hours?: number[];
      };
    };
    const c = body.current;
    const d = body.daily;
    if (!c || !d?.precipitation_sum) return null;

    const rainMm = d.precipitation_sum.reduce((s, n) => s + (n ?? 0), 0);
    const maxTempC = Math.max(...(d.temperature_2m_max ?? [0]));
    const minTempC = Math.min(...(d.temperature_2m_min ?? [0]));
    // A "rain day" here is a day with a meaningful amount of rain, not a trace.
    const rainDays = d.precipitation_sum.filter((n) => (n ?? 0) >= 2).length;

    return {
      lat,
      lng,
      now: {
        tempC: c.temperature_2m,
        humidity: c.relative_humidity_2m,
        precipitationMm: c.precipitation,
        windKph: c.wind_speed_10m,
        code: c.weather_code,
      },
      week: { rainMm, maxTempC, minTempC, rainDays },
      implication: demandFromRain(rainMm, rainDays).implication,
    };
  } catch {
    return null;
  }
}
