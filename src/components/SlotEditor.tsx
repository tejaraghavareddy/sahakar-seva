import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { Panel } from "@/components/terminal";
import {
  SLOT_PARTS,
  isSlotSet,
  upcomingDays,
  type SlotPart,
} from "@/lib/slots";

/**
 * When the worker is actually available.
 *
 * `isOnline` says "not sleeping". A household booking an electrician wants to
 * know when the person is around, because that is what decides whether the visit
 * charge is worth it. This is the honest version of availability: three coarse
 * parts of a day, for the coming week, chosen by the worker themselves.
 *
 * Coarse on purpose. A worker travelling between three jobs cannot promise a
 * 15-minute window, and a calendar that pretends otherwise is worse than no
 * calendar at all.
 */
export default function SlotEditor({ slots }: { slots: number }) {
  const { t } = useLang();
  const setSlot = useMutation(api.artisans.setSlots);
  const days = upcomingDays();

  return (
    <Panel title={t("av_title")} bodyClassName="p-4">
      <p className="text-[11px] leading-relaxed text-slate-500">
        {t("av_sub")}
      </p>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[320px]">
          <div className="grid grid-cols-[64px_repeat(3,1fr)] gap-1.5">
            <span />
            {SLOT_PARTS.map((p) => (
              <span
                key={p}
                className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400"
              >
                {t(`av_${p}`)}
              </span>
            ))}

            {days.map((d) => (
              <div key={d.offset} className="contents">
                <span className="flex items-center text-[11px] font-bold text-slate-700">
                  {d.label}
                </span>
                {SLOT_PARTS.map((p) => {
                  const on = isSlotSet(slots, d.offset, p as SlotPart);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setSlot({ day: d.offset, part: p, on: !on })
                      }
                      className={`rounded-lg border py-2 text-[10px] font-bold transition active:scale-95 ${
                        on
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {on ? "✓" : "—"}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
