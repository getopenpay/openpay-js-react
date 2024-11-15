/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@getopenpay/config/eslint')],
  ignorePatterns: ['vite.config.ts', 'dist/', 'node_modules/', 'vite-env.d.ts'],
};
