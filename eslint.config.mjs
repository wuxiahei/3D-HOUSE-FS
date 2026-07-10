import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    settings: {
      next: {
        rootDir: "apps/web/",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["apps/web/next-env.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/*.tsbuildinfo",
    "output/**",
  ]),
]);
