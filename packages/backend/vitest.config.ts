import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          // convex-test runs functions in the same runtime Convex uses.
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
          include: ["convex/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "checks",
          environment: "node",
          include: ["checks/**/*.test.ts"],
        },
      },
    ],
  },
});
