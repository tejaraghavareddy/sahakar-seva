import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Backend tests (convex-test) need node; render tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["src/test/setup.tsx"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
