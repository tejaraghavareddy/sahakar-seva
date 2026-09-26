import { useQuery } from "convex/react";
import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { RequireAuth } from "@/components/RequireAuth";
import RequireAdmin from "@/components/RequireAdmin";
import RequireSuperAdmin from "@/components/RequireSuperAdmin";
import SuperAdmin from "@/pages/SuperAdmin";
import { useAuth } from "@/hooks/use-auth";

/* ── Lazy route components (code-split portals) ─────────────── */

const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const CustomerAuthPage = lazy(() => import("./pages/CustomerAuth.tsx"));
const WorkerAuthPage = lazy(() => import("./pages/WorkerAuth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Services = lazy(() => import("./pages/Services.tsx"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail.tsx"));
const WorkerProfile = lazy(() => import("./pages/WorkerProfile.tsx"));
const Book = lazy(() => import("./pages/Book.tsx"));
const Bookings = lazy(() => import("./pages/Bookings.tsx"));
const BookingDetail = lazy(() => import("./pages/BookingDetail.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Welfare = lazy(() => import("./pages/Welfare.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

/* ── Application view & session model ───────────────────────── */

/** The four top-level application views (single-page state router). */
export type AppView = "landing" | "customer" | "worker" | "admin";

/** Authenticated portal role, derived from federation records. */
export type SessionRole = "customer" | "worker" | "admin";

/**
 * Normalized session for the signed-in member, regardless of the underlying
 * auth mechanism (email OTP, anonymous guest, etc.).
 */
export interface UserSession {
  uid: string;
  role: SessionRole;
  name: string;
  email?: string;
  phone?: string;
  /** Present when the member has completed worker onboarding. */
  workerId?: string;
  photoURL?: string;
}

/**
 * Resolve the portal role for a member. Federation admins (role on the user
 * record, i.e. the owner email) take precedence; an artisan profile marks a
 * worker; everyone else is a customer/booker.
 */
function deriveSession(
  user: Doc<"users"> | null,
  artisan?: Doc<"artisans"> | null,
): UserSession | null {
  if (!user) return null;
  const role: SessionRole =
    user.role === "admin" ? "admin" : artisan ? "worker" : "customer";
  return {
    uid: user._id,
    role,
    name: user.name || user.email?.split("@")[0] || "Member",
    email: user.email ?? undefined,
    phone: artisan?.phone,
    workerId: artisan?._id,
    photoURL: user.image ?? undefined,
  };
}

/** Map a URL path to its owning application view. */
function viewFromPath(pathname: string): AppView {
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")) {
    return "worker";
  }
  if (pathname.startsWith("/welfare")) return "worker";
  if (pathname.startsWith("/admin")) return "admin";
  if (
    pathname.startsWith("/services") ||
    pathname.startsWith("/workers") ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/bookings")
  ) {
    return "customer";
  }
  return "landing"; // "/", "/auth" and anything unknown are gateway-level
}

/** Entry route for a view, aware of the member's onboarding state. */
function pathForView(view: AppView, session: UserSession | null): string {
  switch (view) {
    case "landing":
      return "/";
    case "customer":
      return "/services";
    case "worker":
      return session?.workerId ? "/dashboard" : "/onboarding";
    case "admin":
      return "/admin";
  }
}

/** The portal home route for a session (or the gateway when signed out). */
export function homeForSession(session: UserSession | null): string {
  if (!session) return "/";
  switch (session.role) {
    case "admin":
      return "/admin";
    case "worker":
      return session.workerId ? "/dashboard" : "/onboarding";
    default:
      return "/services";
  }
}

/* ── Session & navigation context ───────────────────────────── */

interface SessionContextValue {
  /** Application view owning the current URL. */
  view: AppView;
  /** Resolved member session, or null while resolving / signed out. */
  session: UserSession | null;
  /** True while auth and artisan-profile state are still loading. */
  isResolving: boolean;
  isAuthenticated: boolean;
  /** SPA transition into a portal view (preserves back/forward history). */
  navigateView: (view: AppView, opts?: { replace?: boolean }) => void;
  /** Navigate to the current session's portal home. */
  goHome: () => void;
  /** Direct back-navigation without a page reload. */
  back: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <App />");
  return ctx;
}

function SessionProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const artisan = useQuery(api.artisans.getMyArtisan, {});
  const navigate = useNavigate();
  const location = useLocation();

  const isResolving = isLoading || artisan === undefined;
  const session = useMemo(
    () => (isResolving ? null : deriveSession(user ?? null, artisan)),
    [isResolving, user, artisan],
  );

  const view = useMemo(
    () => viewFromPath(location.pathname),
    [location.pathname],
  );

  const navigateView = useCallback(
    (next: AppView, opts?: { replace?: boolean }) => {
      navigate(pathForView(next, session), opts);
    },
    [navigate, session],
  );

  const goHome = useCallback(
    () => navigate(homeForSession(session)),
    [navigate, session],
  );

  const back = useCallback(() => navigate(-1), [navigate]);

  const value = useMemo(
    () => ({
      view,
      session,
      isResolving,
      isAuthenticated,
      navigateView,
      goHome,
      back,
    }),
    [view, session, isResolving, isAuthenticated, navigateView, goHome, back],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/* ── Route guards ───────────────────────────────────────────── */

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="animate-pulse text-sm font-semibold text-slate-400">
        Loading…
      </div>
    </div>
  );
}

/** Federation-officer gate is now in components/RequireAdmin.tsx (uses RequireAuth). */

/* ── Platform route-sync bridge (preview toolbar integration) ── */

function RouteSyncer() {
  const location = useLocation();

  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/* ── Unified application router ─────────────────────────────── */

export default function App() {
  return (
    <BrowserRouter>
      <RouteSyncer />
      <SessionProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Gateway */}
            <Route path="/" element={<Landing />} />
            <Route
              path="/auth"
              element={<AuthPage redirectAfterAuth="/dashboard" />}
            />
            <Route
              path="/login/customer"
              element={<CustomerAuthPage />}
            />
            {/* Worker sign-in. Its own route so a worker deep-linking to the
                dashboard gets a worker screen, not the customer one. */}
            <Route path="/login/worker" element={<WorkerAuthPage />} />

            {/* Customer portal — browse, book, pay, track */}
            <Route path="/services" element={<Services />} />
            <Route path="/services/:id" element={<ServiceDetail />} />
            {/* A worker's public page — reputation, experience and reviews */}
            <Route path="/workers/:id" element={<WorkerProfile />} />
            <Route
              path="/book/:id"
              element={
                <RequireAuth>
                  <Book />
                </RequireAuth>
              }
            />
            <Route
              path="/bookings"
              element={
                <RequireAuth>
                  <Bookings />
                </RequireAuth>
              }
            />
            <Route
              path="/bookings/:id"
              element={
                <RequireAuth>
                  <BookingDetail />
                </RequireAuth>
              }
            />

            {/* Worker portal — hub, telemetry, onboarding */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <Onboarding />
                </RequireAuth>
              }
            />
            <Route
              path="/welfare"
              element={
                <RequireAuth>
                  <Welfare />
                </RequireAuth>
              }
            />

            {/* Federation admin portal — governance console */}
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <Admin />
                  </RequireAdmin>
                </RequireAuth>
              }
            />

            {/* Super-admin portal — platform governance tier */}
            <Route
              path="/super"
              element={
                <RequireAuth>
                  <RequireSuperAdmin>
                    <SuperAdmin />
                  </RequireSuperAdmin>
                </RequireAuth>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </SessionProvider>
    </BrowserRouter>
  );
}
