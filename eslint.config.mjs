import expoConfig from "eslint-config-expo/flat.js";
import perfectionist from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import { defineConfig, globalIgnores } from "eslint/config";

const lintFiles = [
  "index.js",
  "eslint.config.mjs",
  "core/**/*.{js,jsx,ts,tsx}",
  "supabase/services/**/*.{js,jsx,ts,tsx}",
];

export default defineConfig([
  globalIgnores([
    "supabase/functions/**",
    "android/**",
    "ios/**",
    "node_modules/**",
    ".expo/**",
    ".cache/**",
    "dist/**",
    "build/**",
    "web-build/**",
    "coverage/**",
    "generated/**",
  ]),
  {
    extends: [
      expoConfig,
      perfectionist.configs["recommended-natural"],
      eslintPluginPrettierRecommended,
    ],
    files: lintFiles,
    rules: {
      "no-console": "warn",
      "no-debugger": "error",
    },
  },
]);
