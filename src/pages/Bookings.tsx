import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { getService, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge, Panel, TlButton } from "@/components/terminal";
import { ArrowRight, CalendarDays } from "lucide-react";

const STATUS_TONE: Record<string, "neutral" | "ok" | "warn" | "saffron"> = {
  pending: "warn",
  accepted: "saffron",
  enroute: "saffron",
  inprogress: "saffron",
  payment: "warn",
  completed: "ok",
  settled: "ok",
  cancelled: "neutral",
};

export default function Bookings() {
  const { t } = useLang();
  const bookings = useQuery(api.bookings.listForCustomer, {}) ?? [];

  return (
    <div className="tl-shell">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("bks_title")}</h1>

        {bookings.length === 0 ? (
          <Panel className="mt-6">
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <CalendarDays className="size-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("bks_empty")}
              </p>
              <Link to="/services">
                <TlButton variant="saffron" className="tl-btn-saffron">
                  {t("bks_browse")}
                  <ArrowRight className="size-4" />
                </TlButton>
              </Link>
            </div>
          </Panel>
        ) : (
          <div className="mt-6 space-y-3">
            {bookings.map((b) => {
              const svc = getService(b.serviceId);
              const Icon = svc?.icon;
              const soft = COLOR_SOFT[svc?.color ?? "ok"];
              return (
                <Link key={b._id} to={`/bookings/${b._id}`}>
                  <Panel bodyClassName="p-4" className="transition-shadow hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-sm ${soft}`}
                      >
                        {Icon && <Icon className="size-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {b.serviceName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {new Date(b.scheduledFor).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                          {" · "}
                          {b.address}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <MonoBadge tone={STATUS_TONE[b.status] ?? "neutral"}>
                          {t(`st_${b.status}`)}
                        </MonoBadge>
                        <p className="mt-1 text-sm font-bold">₹{b.total}</p>
                      </div>
                    </div>
                  </Panel>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
