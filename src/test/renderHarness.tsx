/** @vitest-environment jsdom */
import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { LanguageProvider } from "@/lib/i18n";
import { resetConvexMocks } from "./setup";

/**
 * Mount a page the way the real app does: inside a router (with a matching
 * `<Route>` so `useParams()` resolves) and the language provider supplying
 * `t()`. The Convex client itself is mocked globally in ./setup.tsx.
 */
export function renderPage(
  element: ReactElement,
  {
    route = "/",
    path = "*",
  }: { route?: string; path?: string } = {},
): RenderResult {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LanguageProvider>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

/** Call before each render test so mocked query results never leak between them. */
export function freshMocks() {
  resetConvexMocks();
}
