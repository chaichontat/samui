module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  plugins: ['svelte3', '@typescript-eslint'],
  ignorePatterns: ['node_modules', 'build', '.svelte-kit', '*.cjs', 'svelte.config.js'],
  overrides: [{ files: ['*.svelte'], processor: 'svelte3/svelte3' }],
  settings: {
    'svelte3/typescript': () => require('typescript')
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    extraFileExtensions: ['.svelte'],
    project: ['./tsconfig.json', './prettier.config.js']
  },
  env: {
    browser: true,
    es2020: true,
    node: true
  },
  rules: {
    '@typescript-eslint/no-non-null-assertion': 0,
    '@typescript-eslint/ban-ts-comment': 0
  }
};
