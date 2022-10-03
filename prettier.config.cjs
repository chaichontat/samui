module.exports = {
  plugins: [
    require('prettier-plugin-tailwindcss'),
    require('prettier-plugin-svelte'),
    require('prettier-plugin-packagejson')
  ],
  tailwindConfig: 'tailwind.config.cjs',
  printWidth: 100,
  useTabs: false,
  htmlWhitespaceSensitivity: 'ignore',
  overrides: [
    {
      files: '**/*.svelte',
      options: { parser: 'svelte' }
    },
    {
      files: '**/*.ts',
      options: { parser: 'typescript' }
    }
  ],
  singleQuote: true,
  trailingComma: 'none',
  endOfLine: 'lf'
};
