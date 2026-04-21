/* eslint-env node */
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  root: true,
  ignorePatterns: ["dist", "coverage", "node_modules"],
  extends: [
    "plugin:vue/vue3-essential",
    "eslint:recommended",
    "@vue/eslint-config-typescript",
    "@vue/eslint-config-prettier/skip-formatting",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    parser: "@typescript-eslint/parser",
    sourceType: "module",
  },
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "no-console": ["error", { allow: ["warn", "error"] }],
    "no-useless-escape": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "vue/multi-word-component-names": "off",
  },
  overrides: [
    {
      files: ["src/services/logger.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
};
