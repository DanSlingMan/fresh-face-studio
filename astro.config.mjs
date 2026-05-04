import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* Reskin preview gate (Commit A of the GG visual reskin).
   When USE_DARK_TOKENS is set in the build environment, the @active-dark-tokens
   alias resolves to the real dark token set; otherwise it resolves to an empty
   stub so production builds carry no dark-token bytes. Single source of truth. */
const USE_DARK_TOKENS =
  process.env.USE_DARK_TOKENS === 'true' || process.env.USE_DARK_TOKENS === '1';

const activeDarkTokensPath = USE_DARK_TOKENS
  ? path.resolve(__dirname, 'src/styles/tokens.dark.css')
  : path.resolve(__dirname, 'src/styles/_tokens.empty.css');

export default defineConfig({
  integrations: [react()],
  site: 'https://yourfreshface.com',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      cssMinify: true,
    },
    resolve: {
      alias: {
        '@active-dark-tokens': activeDarkTokensPath,
      },
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
