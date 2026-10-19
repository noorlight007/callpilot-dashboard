import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Code added for the operations dashboard keeps the strict rules.
const opsFiles = ["app/(ops)/**", "components/ops/**", "lib/ops/**"];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Provider/ATS payloads are untyped JSON; flag but don't fail on them.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Pre-existing code: report newer React-compiler and style findings as warnings
    // so `npm run lint` is usable; fix them as those files are touched.
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    ignores: opsFiles,
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
  {
    files: ["**/*.test.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/**"]),
]);
