import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated/vendor audio analysis assets copied from package builds.
    "public/audio/essentia*.js",
    "public/audio/*.wasm",
    // Local Playwright artifacts from manual browser QA.
    ".playwright-cli/**",
  ]),
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // The existing app has many intentional decorative/randomized render values
      // and ref-backed audio engine bridges. Keep the stable React rules from
      // core-web-vitals, but do not fail the release lint gate on React Compiler
      // advisory rules until those areas are refactored intentionally.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    files: ["src/**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
