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

// Vitest is not running with `globals: true`, so Testing Library's automatic
// cleanup is not installed — without this, one test's DOM leaks into the next.
afterEach(() => {
  cleanup();
});

/** What each Convex function should resolve to during a render test. */
export const queryResults = new Map<string, unknown>();

/** Mutations the page called, as `"module.function"` → argument list. */
export const mutationCalls: { path: string; args: unknown }[] = [];

export function resetConvexMocks() {
  queryResults.clear();
  mutationCalls.length = 0;
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
      return undefined;
    };
  };
  return {
    useQuery,
    useMutation,
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
    signIn: async () => {},
    signOut: async () => {},
    useAccessToken: () => undefined,
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { _id: "user1", name: "Test User", email: "test@example.com" },
    signIn: async () => {},
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
