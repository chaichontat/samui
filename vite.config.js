import path from 'path';
import { searchForWorkspaceRoot } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

/**
 * @type {import('vite').UserConfig}
 */
const config = {
  plugins: [sveltekit()],
  resolve: {
    alias: {
      $src: path.resolve('./src'),
      $comps: path.resolve('./src/lib/components')
    }
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())]
    }
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1024
  },

  test: {
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: 'setupTest.js'
  }
};
export default config;
