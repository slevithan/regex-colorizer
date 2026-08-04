export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  jsxSingleQuote: true,
  trailingComma: 'none',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss' // must be last
  ],
  importOrder: [
    '^react$',
    '',
    '<TYPES>',
    '<TYPES>^[.]',
    '',
    '<THIRD_PARTY_MODULES>',
    '',
    '^[@]/',
    '',
    '^[.]'
  ]
};
