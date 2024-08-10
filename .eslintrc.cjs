module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:prettier/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: [
        '**/*.ts',
        '**/*.tsx',
      ],
      parser: '@typescript-eslint/parser',
      plugins: [
        '@typescript-eslint'
      ],
      extends: [
        'plugin:react-hooks/recommended',
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': 'error',
        'jsx-a11y/no-autofocus': 'off',
        'jsx-a11y/click-events-have-key-events': 'off',
        '@typescript-eslint/explicit-function-return-type': [
          'warn',
          {
            allowExpressions: true,
            allowConciseArrowFunctionExpressionsStartingWithVoid: true
          }
        ],
        'prettier/prettier': [
          'error',
          {
            endOfLine: 'auto',
            semi: true,
            trailingComma: 'es5',
            singleQuote: true,
            printWidth: 120,
            tabWidth: 2,
            useTabs: false
          }
        ]
      }
    }
  ]
}
