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
    // 🎯 O Fix Principal: O parser do Vue deve envolver o do TypeScript
    parser: '@typescript-eslint/parser',
    sourceType: 'module'
  },
  rules: {
    // Silencia variáveis não usadas que começam com "_"
    '@typescript-eslint/no-unused-vars': ['error', { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    
    // Permite console.log em desenvolvimento
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    
    // Resolve o erro de escape no seu schema de produtos
    'no-useless-escape': 'off',
    
    // Resolve o erro do empty object "{}" no shims-vue.d.ts
    '@typescript-eslint/no-empty-object-type': 'off',

    // Desativa a regra que exige nomes de componentes com múltiplas palavras (opcional)
    'vue/multi-word-component-names': 'off'
  }
}