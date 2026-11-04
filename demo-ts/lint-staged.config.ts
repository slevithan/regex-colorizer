import path from 'node:path';

const tsc = () => 'tsc --noEmit';

const eslint = (fileNames: string[]) =>
  `eslint --fix ${fileNames.map((fileName) => path.relative(process.cwd(), fileName)).join(' ')}`;

const prettier = (fileNames: string[]) =>
  `prettier --write ${fileNames.map((fileName) => path.relative(process.cwd(), fileName)).join(' ')} --cache`;

export default {
  '*.{ts,mts,cts}': [tsc],
  '*.{js,mjs,cjs,ts,mts,cts}': [eslint],
  '*.{html,css,scss,js,jsx,cjs,mjs,ts,tsx,mdx}': [prettier]
};
