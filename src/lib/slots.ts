/**
 * Working slots, as a bitmask over the coming week.
 *
 * A worker is not a calendar API. What a household actually books is "Thursday
 * evening", and what a worker walking between three jobs can honestly promise is
 * "I am around on Thursday evening" — not a to-the-minute calendar. So the model
 * is deliberately coarse: 7 days × 3 parts of day, one bit each, no times.
 *
 * A bitmask rather than an array of rows because the whole thing is read on
 * every catalog render and written rarely. One integer per worker, indexable.
 */

export const SLOT_PARTS = ["morning", "afternoon", "evening"] as const;
export type SlotPart = (typeof SLOT_PARTS)[number];
export const SLOT_DAYS = 7;

/** Bit position for a given day-of-week offset and part of day. */
export function slotBit(day: number, part: SlotPart): number {
  return day * SLOT_PARTS.length + SLOT_PARTS.indexOf(part);
}

export function isSlotSet(mask: number | undefined, day: number, part: SlotPart): boolean {
  if (!mask) return false;
  return (mask & (1 << slotBit(day, part))) !== 0;
}

export function withSlot(
  mask: number | undefined,
  day: number,
  part: SlotPart,
  on: boolean,
): number {
  const next = mask ?? 0;
  const bit = 1 << slotBit(day, part);
  return on ? next | bit : next & ~bit;
}

export function countSlots(mask: number | undefined): number {
  if (!mask) return 0;
  let n = 0;
  for (let i = 0; i < SLOT_DAYS * SLOT_PARTS.length; i++) {
    if (mask & (1 << i)) n += 1;
  }
  return n;
}

/** Which parts of the given day are open, for the booking form's slot picker. */
export function partsForDay(mask: number | undefined, day: number): SlotPart[] {
  return SLOT_PARTS.filter((p) => isSlotSet(mask, day, p));
}

/** Day labels, starting today, for a 7-day picker. */
export function upcomingDays(from = new Date()): { offset: number; label: string }[] {
  return Array.from({ length: SLOT_DAYS }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return {
      offset: i,
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
    };
  });
}

/** Which part of the day a timestamp falls in, so a booking maps to a slot. */
export function partOfDay(at: Date): SlotPart {
  const h = at.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/** Day offset from today (0-based) for a timestamp, clamped into the week. */
export function dayOffset(at: Date, from = new Date()): number {
  const startOfToday = new Date(from);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(at);
  startOfTarget.setHours(0, 0, 0, 0);
  const days = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000,
  );
  return Math.max(0, Math.min(SLOT_DAYS - 1, days));
}
