import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
      "node_modules/",
      "dist/",
      "build/",
      "app/",
      "scanner/",
      "admin/",
      "agent/",
    ]),
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs" },
    // Ignore folders you don't want to lint
  
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      "app/",
      "scanner/",
      "admin/",
      "agent/",
    ],
  },
]);
