import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/lib/i18n";
import { Panel } from "@/components/terminal";
import GroupDetail from "@/components/GroupDetail";

/**
 * "3 people near you need a plumber this evening."
 *
 * This is the discovery half of shared booking, and it is deliberately readable
 * without a sign-in: the pitch only works if a customer can see that the
 * co-demand already exists before deciding to commit to anything. The query
 * behind it projects a service, a window and a count — never an address.
 */
export default function GroupBookingCard({
  trade,
  lat,
  lng,
}: {
  /** Omit to show co-demand across every trade. */
  trade?: string;
  lat?: number;
  lng?: number;
}) {
  const { t } = useLang();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = useQuery(
    api.bookingGroups.nearbyOpen,
    lat !== undefined ? { trade, lat, lng } : { trade },
  );
  const join = useMutation(api.bookingGroups.join);

  if (!groups || groups.length === 0) return null;

  async function doJoin(id: string) {
    setBusyId(id);
    try {
      await join({ id: id as never });
    } catch {
      // surfaced via the Convex error toast; the card re-renders either way
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel
      className="border-teal-200 bg-teal-50/40"
      title={t("gb_title")}
      bodyClassName="p-4"
    >
      <p className="text-[11px] leading-relaxed text-teal-900/80">
        {t("gb_sub")}
      </p>

      <ul className="mt-3 space-y-2">
        {groups.map((g) => (
          <li
            key={g._id}
            className="rounded-xl border border-teal-200 bg-white px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900">
                {g.serviceName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {new Date(g.windowStart).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {g.distM !== null ? ` · ${(g.distM / 1000).toFixed(1)} km` : ""}
              </p>
              <p className="mt-0.5 text-[10px] font-bold text-teal-700">
                {g.filled} {t("gb_of")} {g.maxShares} {t("gb_households")} ·{" "}
                {g.spotsLeft} {t("gb_spots")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenId(openId === g._id ? null : g._id)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                {t("gb_details")}
              </button>
              <button
                type="button"
                onClick={() => void doJoin(g._id)}
                disabled={busyId === g._id || g.spotsLeft <= 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-teal-800 active:scale-95 disabled:opacity-50"
              >
                {busyId === g._id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : null}
                {g.spotsLeft <= 0 ? t("gb_full") : t("gb_join")}
              </button>
            </div>
            {openId === g._id && (
              <GroupDetail
                groupId={g._id as Id<"bookingGroups">}
                onLeft={() => setOpenId(null)}
              />
            )}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 text-[10px] leading-relaxed text-teal-900/60">
        {t("gb_note")}
      </p>
    </Panel>
  );
}
