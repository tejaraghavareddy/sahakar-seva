import { useQuery } from "convex/react";
import { CheckCircle2, ExternalLink, Info, Loader2, Wallet } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { BackToHome } from "@/components/BackToHome";
import { Panel } from "@/components/terminal";

/**
 * Social security, read off the cooperative's own books.
 *
 * A marketplace has no reason to know what a worker earns. A cooperative does —
 * it holds the settlements — and that is the whole argument for the ownership
 * model: the collective is the only party in the transaction able to say "you
 * have now crossed the threshold for X".
 *
 * Nothing is applied for here and no document ever reaches this page. Each
 * scheme links out to the official government portal, opened in the member's own
 * browser, where they use their own login. The cooperative stays out of the
 * identity system entirely — which is also why the disclaimer below is stated
 * plainly instead of being buried.
 */
export default function Welfare() {
  const { t } = useLang();
  const data = useQuery(api.welfareSchemes.myEligibility, {});

  if (data === undefined) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <BackToHome />

        <h1 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          {t("wf_title")}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">{t("wf_sub")}</p>

        {!data ? (
          <Panel className="mt-5" bodyClassName="p-6">
            <p className="text-sm text-slate-600">{t("wf_none")}</p>
          </Panel>
        ) : (
          <>
            {/* What the cooperative's own record says */}
            <Panel className="mt-5" bodyClassName="p-4">
              <p className="tl-label mb-2">{t("wf_based")}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5">
                  <p className="text-sm font-black text-slate-900">
                    {data.profile.tradeLabel}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                    {t("wf_trade")}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5">
                  <p className="text-sm font-black text-slate-900">
                    ₹{data.profile.annualIncome.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                    {t("wf_income")}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5">
                  <p className="text-sm font-black text-slate-900">
                    {data.profile.completedJobs}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                    {t("wf_jobs")}
                  </p>
                </div>
              </div>
            </Panel>

            {/* Schemes */}
            <div className="mt-5 space-y-3">
              {data.schemes.map((s) => (
                <Panel
                  key={s.id}
                  className={s.likelyEligible ? "border-emerald-200" : undefined}
                  bodyClassName="p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        {s.name}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {s.benefit}
                      </p>
                    </div>
                    {s.likelyEligible ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 className="size-3" />
                        {t("wf_eligible")}
                      </span>
                    ) : null}
                  </div>

                  {s.unmet.length > 0 && (
                    <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        {t("wf_check")}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {s.unmet.map((u) => (
                          <li
                            key={u}
                            className="text-[11px] leading-relaxed text-amber-900"
                          >
                            • {u}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <details className="mt-2.5">
                    <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">
                      {t("wf_criteria")}
                    </summary>
                    <ul className="mt-1.5 space-y-0.5">
                      {s.criteria.map((c) => (
                        <li
                          key={c}
                          className="text-[11px] leading-relaxed text-slate-600"
                        >
                          • {c}
                        </li>
                      ))}
                    </ul>
                  </details>

                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    <ExternalLink className="size-3" />
                    {t("wf_apply")}
                  </a>
                </Panel>
              ))}
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
              <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              {data.disclaimer}
            </p>

            <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
              <Wallet className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              {t("wf_privacy")}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
