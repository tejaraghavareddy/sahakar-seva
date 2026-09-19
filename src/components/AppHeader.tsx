import { Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { LanguagePicker, TlButton } from "@/components/terminal";
import { HandHeart, LogOut } from "lucide-react";

export function AppHeader() {
  const { t } = useLang();
  const { user, signOut } = useAuth();

  const links = [
    { to: "/services", label: t("nav_services") },
    { to: "/bookings", label: t("nav_bookings") },
    { to: "/dashboard", label: t("nav_hub") },
    { to: "/admin", label: t("nav_admin") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-800 text-white">
            <HandHeart className="size-4" />
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-900">
            Sahakar Seva
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguagePicker />
          {user && (
            <TlButton variant="ghost" onClick={() => void signOut()}>
              <LogOut className="size-4" />
            </TlButton>
          )}
        </div>
      </div>
      {/* mobile nav */}
      <nav className="flex items-center justify-center gap-1 border-t border-slate-100 px-2 py-1.5 md:hidden">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-xl px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
