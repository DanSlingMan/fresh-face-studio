import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://freshfacestudio.com',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      cssMinify: true,
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
