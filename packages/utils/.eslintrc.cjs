/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@getopenpay/eslint-config/library.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
  ignorePatterns: ['vite.config.ts', 'dist/', 'node_modules/', 'vite-env.d.ts'],
};
