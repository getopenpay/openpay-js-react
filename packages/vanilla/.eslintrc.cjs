/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@getopenpay/eslint-config/library.js'],
  ignorePatterns: ['vite.config.ts', 'dist/', 'node_modules/', 'vite-env.d.ts'],
};