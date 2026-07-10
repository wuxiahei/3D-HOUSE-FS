import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/test/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
      "apps/web/src/**/*.test.tsx",
    ],
    environment: "node",
    environmentMatchGlobs: [
      ["apps/web/src/**/*.tsx", "jsdom"],
      ["apps/web/src/hooks/**/*.ts", "jsdom"],
    ],
    setupFiles: ["apps/web/src/test/setup.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "packages/core/src/**/*.{ts,tsx}",
        "packages/simulation/src/**/*.{ts,tsx}",
        "apps/web/src/editor/**/*.{ts,tsx}",
        "apps/web/src/hooks/**/*.{ts,tsx}",
      ],
    },
  },
});
