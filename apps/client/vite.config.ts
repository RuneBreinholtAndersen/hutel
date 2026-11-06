import { defineConfig } from 'vite';

/** Changes on every build. The server reads dist/version.json and tells old tabs to reload. */
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  envDir: '../..',
  server: { port: 5173 },
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    {
      name: 'hutel-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ build: BUILD_ID }),
        });
      },
    },
  ],
});
