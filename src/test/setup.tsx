/**
 * Global test setup.
 *
 * The app is a Convex + React app, so rendering a page for a smoke test means
 * standing in for the reactive client. The registry below lets each test decide
 * what every `useQuery(...)` resolves to, keyed by `"module.function"`, so a
 * page can be rendered against a realistic payload without a live deployment.
 */
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { getFunctionName } from "convex/server";

// jsdom implements neither ResizeObserver nor the layout APIs the OTP input
// measures its slots with. The component is real code, not stubbed, so give it
// the globals it expects rather than mocking the sign-in code entry away.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// input-otp resolves the caret position on a timer after a paste/keystroke;
// jsdom has no layout engine, so there is no element at any point. Without
// this the component throws after the test that rendered it has passed.
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// Vitest is not running with `globals: true`, so Testing Library's automatic
// cleanup is not installed — without this, one test's DOM leaks into the next.
afterEach(() => {
  cleanup();
});

/** What each Convex function should resolve to during a render test. */
export const queryResults = new Map<string, unknown>();

/** Mutations the page called, as `"module.function"` → argument list. */
export const mutationCalls: { path: string; args: unknown }[] = [];

/**
 * Errors a mutation should reject with, keyed by `"module.function"`. Lets a
 * render test exercise the "the server refused this" path — which is how a
 * scoped federation admin finds out they touched another federation's work.
 */
export const mutationErrors = new Map<string, string>();

/** Values actions resolve to during a render test, keyed by `"module.function"`. */
export const actionResults = new Map<string, unknown>();

/** Actions the page invoked, as `"module.function"` → argument list. */
export const actionCalls: { path: string; args: unknown }[] = [];

/**
 * Auth `signIn` calls the page made, flattened the way the Convex Auth client
 * flattens them: the FormData entries become the params object sent to
 * `auth:signIn`.
 *
 * This matters because the OTP flow branches on whether `code` is *present*,
 * not whether it is non-empty — an empty `code` silently selects the verify
 * path and no code is ever sent. Only a test that can see the real params can
 * catch that.
 */
export const authSignInCalls: {
  provider: string;
  params: Record<string, string>;
}[] = [];

export function resetConvexMocks() {
  queryResults.clear();
  mutationCalls.length = 0;
  mutationErrors.clear();
  actionResults.clear();
  actionCalls.length = 0;
  authSignInCalls.length = 0;
}

/** The generated `api` proxy exposes each reference's path behind a symbol. */
function pathOf(ref: unknown): string {
  try {
    return getFunctionName(ref as never);
  } catch {
    return "unknown";
  }
}

vi.mock("convex/react", () => {
  const useQuery = (ref: unknown, args?: unknown) => {
    const path = pathOf(ref);
    // "skip" is Convex's idiom for "don't run this subscription".
    if (args === "skip") return undefined;
    return queryResults.get(path);
  };
  const useMutation = (ref: unknown) => {
    const path = pathOf(ref);
    return async (args: unknown) => {
      mutationCalls.push({ path, args });
      const err = mutationErrors.get(path);
      if (err) throw new Error(err);
      return undefined;
    };
  };
  const useAction = (ref: unknown) => {
    const path = pathOf(ref);
    return async (args: unknown) => {
      actionCalls.push({ path, args });
      return actionResults.get(path);
    };
  };
  return {
    useQuery,
    useMutation,
    useAction,
    usePaginatedQuery: () => ({
      results: [],
      status: "CanLoadMore",
      isLoading: false,
      loadMore: async () => {},
      loadAll: async () => {},
    }),
    useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
    ConvexProvider: ({ children }: { children: React.ReactNode }) => children,
    ConvexReactClient: class {},
  };
});

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    // Mirror the real client: FormData entries become the params object.
    signIn: async (provider: string, args?: FormData | Record<string, string>) => {
      const params: Record<string, string> = {};
      if (args instanceof FormData) {
        args.forEach((value, key) => {
          params[key] = String(value);
        });
      } else {
        Object.assign(params, args ?? {});
      }
      authSignInCalls.push({ provider, params });
    },
    signOut: async () => {},
    useAccessToken: () => undefined,
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { _id: "user1", name: "Test User", email: "test@example.com" },
    signIn: async (provider: string, args?: FormData | Record<string, string>) => {
      const params: Record<string, string> = {};
      if (args instanceof FormData) {
        args.forEach((value, key) => {
          params[key] = String(value);
        });
      } else {
        Object.assign(params, args ?? {});
      }
      authSignInCalls.push({ provider, params });
    },
    signOut: async () => {},
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  Toaster: () => null,
}));

// Leaflet needs a real browser; the map components are not what these smoke
// tests are checking.
vi.mock("react-leaflet", () => {
  const stub = (name: string) => {
    const C = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
    C.displayName = name;
    return C;
  };
  return {
    MapContainer: stub("MapContainer"),
    TileLayer: stub("TileLayer"),
    Marker: stub("Marker"),
    Popup: stub("Popup"),
    Circle: stub("Circle"),
    CircleMarker: stub("CircleMarker"),
    Polyline: stub("Polyline"),
    useMap: () => ({ setView: () => {}, getZoom: () => 12 }),
    useMapEvents: () => ({}),
  };
});

vi.mock("leaflet", () => {
  const layer = () => ({ bindPopup: () => layer(), addTo: () => layer() });
  return {
    default: {
      map: () => ({ setView: () => {}, remove: () => {} }),
      tileLayer: () => ({ addTo: () => {} }),
      marker: () => ({ setLatLng: () => ({ bindPopup: () => ({ addTo: () => {} }) }) }),
      divIcon: () => ({}),
      latLngBounds: () => ({}),
      circle: layer,
      polygon: layer,
      CRS: { EPSG3857: "EPSG3857" },
    },
  };
});
