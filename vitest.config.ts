import { defineConfig } from "vitest/config";
import path from "path";

// Deliberately separate from vite.config.ts: that one loads
// vite-plugin-electron, which would try to bundle and launch the main process.

// Pin the zone so date logic is deterministic across machines. Bucharest
// observes DST, so schedule tests can exercise the transitions for real.
process.env.TZ = "Europe/Bucharest";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@shared", replacement: path.resolve(__dirname, "src/shared") },
      { find: /^electron$/, replacement: path.resolve(__dirname, "test/mocks/electron.ts") },
      {
        find: /^electron-store$/,
        replacement: path.resolve(__dirname, "test/mocks/electron-store.ts"),
      },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["electron/**/*.test.ts", "src/shared/**/*.test.ts"],
          setupFiles: ["test/setup.ts"],
        },
      },
      {
        // Remote and display components and hooks, rendered with React
        // Testing Library into a simulated DOM.
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["src/remote/**/*.test.{ts,tsx}", "src/display/**/*.test.{ts,tsx}"],
          setupFiles: ["test/setup.dom.ts"],
        },
      },
    ],
  },
});
