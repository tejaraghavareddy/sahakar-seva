import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { LanguagePicker } from "@/components/terminal";
import LocationPickerModal from "@/components/map/LocationPickerModal";
import { useDetectedLocation, formatAccuracy } from "@/lib/useLocation";
import {
  CalendarClock,
  HardHat,
  Home,
  LogOut,
  MapPin,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

/** Center-logo header with left nav pills and right utilities. */
export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // Admin link renders only for federation officers (owner email or admin role).
  const amAdmin = useQuery(api.admin.amAdmin, {}) === true;
  const { location, setManual } = useDetectedLocation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const links = [
    { to: "/", label: "Home", icon: Home },
    { to: "/services", label: "Book a Worker", icon: CalendarClock },
    { to: "/dashboard", label: "Worker Portal", icon: HardHat },
    ...(amAdmin
      ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
        {/* Left: nav pills */}
        <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-emerald-800 hover:shadow-xs"
            >
              <l.icon className="size-3.5 text-emerald-600" />
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Center: brand */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-base font-black text-white shadow-md shadow-emerald-600/25 select-none">
            सह
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-black tracking-tight text-slate-900">
              Sahakar Seva
            </span>
            <span className="hidden text-[10px] text-slate-400 italic sm:block">
              Cooperative Digital Service Marketplace
            </span>
          </span>
        </Link>

        {/* Right: utilities */}
        <div className="flex items-center gap-2">
          {/* Live GPS accuracy badge + change location */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            title="Change service location"
            className="hidden max-w-[16rem] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-xs transition hover:border-emerald-300 hover:text-emerald-800 sm:inline-flex"
          >
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <MapPin className="size-3 shrink-0 text-emerald-600" />
            <span className="truncate">{location.label}</span>
            <span className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-1 text-[10px] font-bold text-emerald-700">
              {formatAccuracy(location)}
            </span>
          </button>
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 md:inline-flex">
            📱 Mobile
          </span>
          <LanguagePicker />
          <button
            type="button"
            onClick={() => (user ? void signOut() : navigate("/auth?returnTo=/services"))}
            title={user ? "Sign out" : "Sign in"}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-emerald-700"
          >
            {user ? <LogOut className="size-4" /> : <RotateCcw className="size-4" />}
          </button>
        </div>
      </div>
      {/* Location picker modal */}
      <LocationPickerModal
        open={pickerOpen}
        initialLat={location.lat}
        initialLng={location.lng}
        onConfirm={(loc) => {
          setManual({
            label: loc.address,
            lat: loc.lat,
            lng: loc.lng,
          });
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
      {/* mobile nav */}
      <nav className="flex items-center justify-center gap-1 border-t border-slate-100 px-2 py-1.5 lg:hidden">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <l.icon className="size-3 text-emerald-600" />
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
