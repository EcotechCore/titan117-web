import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The public website uses plain links on purpose: each page is a full load,
    // so /assets/site.js (menus, eyes, filters) runs on every page, as on the
    // static site it came from (decisions §18).
    files: ["app/(site)/**", "components/site/**"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain browser scripts copied from the static site, and bloub's bundled build (MIT).
    "public/assets/**",
  ]),
]);

export default eslintConfig;
