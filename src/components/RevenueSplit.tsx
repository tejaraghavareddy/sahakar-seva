import { BadgeCheck, HandCoins, HeartPulse, Wrench } from "lucide-react";

/**
 * Cooperative revenue split visualization — 90% worker / 7% welfare / 3% ops.
 * Renders a proportional horizontal bar with a legend of INR amounts.
 */
export function RevenueSplitBar({
  total,
  workerShare,
  welfareAmt,
  opsAmt,
  compact = false,
}: {
  total: number;
  workerShare: number;
  welfareAmt: number;
  opsAmt: number;
  compact?: boolean;
}) {
  const denom = Math.max(total, 1);
  const workerPct = (workerShare / denom) * 100;
  const welfarePct = (welfareAmt / denom) * 100;
  const opsPct = (opsAmt / denom) * 100;

  // Welfare listed first — the federation's top-preference share.
  const rows = [
    {
      // Welfare is the federation's top-priority share — highlighted first.
      icon: <HeartPulse className="size-3.5" />,
      label: "Welfare fund",
      pct: "7%",
      amt: welfareAmt,
      dot: "bg-emerald-500",
      text: "text-emerald-800",
      priority: true,
    },
    {
      icon: <HandCoins className="size-3.5" />,
      label: "Worker payout",
      pct: "90%",
      amt: workerShare,
      dot: "bg-slate-900",
      text: "text-slate-800",
    },
    {
      icon: <Wrench className="size-3.5" />,
      label: "Platform maintenance",
      pct: "3%",
      amt: opsAmt,
      dot: "bg-slate-700",
      text: "text-slate-800",
    },
  ];

  return (
    <div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
        <div
          className="h-full bg-emerald-600 transition-all"
          style={{ width: `${workerPct}%` }}
          title={`Worker payout 90% · ₹${workerShare}`}
        />
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${welfarePct}%` }}
          title={`Welfare fund 7% — top priority · ₹${welfareAmt}`}
        />
        <div
          className="h-full bg-slate-700 transition-all"
          style={{ width: `${opsPct}%` }}
          title={`Platform maintenance 3% · ₹${opsAmt}`}
        />
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-1.5">
            <span className={`mt-0.5 inline-block size-2 shrink-0 rounded-full ${r.dot}`} />
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {r.icon}
                <span className="truncate">{r.label}</span>
                {"priority" in r && r.priority && (
                  <BadgeCheck className="size-3 shrink-0 text-emerald-600" aria-label="Top priority" />
                )}
              </p>
              {!compact && (
                <p className={`text-xs font-extrabold ${r.text}`}>
                  {r.pct} · ₹{r.amt.toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
