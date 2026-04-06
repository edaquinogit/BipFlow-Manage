/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    // 🎯 CRITICAL FIX: Vue parser must wrap TypeScript parser
    parser: '@typescript-eslint/parser',
    sourceType: 'module'
  },
  rules: {
    // Silence unused variables starting with "_"
    '@typescript-eslint/no-unused-vars': ['error', { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],

    // Allow console.log in development
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    // Resolve escape sequencing issues in product schema
    'no-useless-escape': 'off',

    // Resolve empty object "{}" error in shims-vue.d.ts
    '@typescript-eslint/no-empty-object-type': 'off',

    // Disable rule requiring multi-word component names (optional)
    'vue/multi-word-component-names': 'off'
  }
}
