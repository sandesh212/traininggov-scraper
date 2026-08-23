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
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "error",
      "react/no-unescaped-entities": "error",
    },
  },
  {
    files: ["src/components/DetailedReportView.tsx", "src/components/UnifiedReportView.tsx"],
    rules: {
      // These views render generated data-URI previews from uploaded DOCX content; Next image optimization is not applicable.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
