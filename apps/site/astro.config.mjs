import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

// Static site for lobbi.dk (uploaded to Simply). The 3D scenes reuse the game's own code.
export default defineConfig({
  site: 'https://lobbi.dk',
  output: 'static',
  build: { format: 'directory' },
  vite: {
    resolve: {
      alias: { '@game': fileURLToPath(new URL('../client/src', import.meta.url)) },
      dedupe: ['three'],
    },
    server: { fs: { allow: ['..', '../..'] } },
  },
});
