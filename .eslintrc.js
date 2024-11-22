module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  rules: {
    semi: ['error', 'never'],
    'comma-dangle': ['error', 'never'],
  },
  ignorePatterns: ['dist/', 'node_modules/']
}
