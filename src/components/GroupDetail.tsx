import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/lib/i18n";
import { getTrade } from "@/lib/trades";

/**
 * Who's in this shared visit, and how much each household owes.
 *
 * The point of a group is that everybody can see it filling up — that shared
 * count is the whole reason to join rather than book alone. So the detail view
 * is not administrative, it is the persuasion. Leaving is offered at the same
 * time, because a household that joined and then changed its mind should be
 * able to, and should not have to cancel a real booking to do it.
 *
 * Addresses of other households are never rendered here: a member sees that
 * people are participating, not where they live.
 */
export default function GroupDetail({
  groupId,
  onLeft,
}: {
  groupId: Id<"bookingGroups">;
  onLeft?: () => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const detail = useQuery(api.bookingGroups.get, { id: groupId });
  const leave = useMutation(api.bookingGroups.leave);

  if (!detail) return null;

  const trade = getTrade(detail.trade);
  const mine = detail.participants.find((p) => p.isYou);
  const others = detail.participants.length - (mine ? 1 : 0);

  async function doLeave() {
    setBusy(true);
    try {
      await leave({ id: groupId });
      onLeft?.();
    } catch {
      // surfaced via the Convex error toast
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2.5 border-t border-slate-100 pt-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
        <Users className="size-3 text-teal-600" />
        {detail.filled} {t("gb_of")} {detail.maxShares}{" "}
        {t("gb_households")} {t("gb_in")} · {t("gb_spots_left")}{" "}
        {detail.spotsLeft}
      </p>

      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {trade?.id ?? detail.trade} ·{" "}
        {new Date(detail.windowStart).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>

      {mine ? (
        <div className="mt-2 rounded-lg bg-teal-50 px-2.5 py-2">
          <p className="text-[11px] font-bold text-teal-900">
            {t("gb_your_share")} ₹{mine.shareAmount ?? "—"}
          </p>
          <button
            type="button"
            onClick={() => void doLeave()}
            disabled={busy}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : null}
            {t("gb_leave")}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">
          {others} {t("gb_others")}
        </p>
      )}
    </div>
  );
}
