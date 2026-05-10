import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Variables/imports déclarés mais non utilisés → avertissement
      "@typescript-eslint/no-unused-vars": "warn",

      // Typage `any` explicite → avertissement
      "@typescript-eslint/no-explicit-any": "warn",

      // Apostrophes/guillemets non échappés dans le JSX → avertissement
      "react/no-unescaped-entities": "warn",

      // Lien <a> au lieu de <Link> → avertissement
      "@next/next/no-html-link-for-pages": "warn",

      // <img> au lieu de <Image> → avertissement
      "@next/next/no-img-element": "warn",

      // <head> au lieu de <Head> → avertissement
      "@next/next/no-head-element": "warn",

      // Hook dependencies → avertissement
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
