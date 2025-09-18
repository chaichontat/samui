import path from 'path';
import { searchForWorkspaceRoot } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { exec } from 'child_process';
import { promisify } from 'util';

// https://stackoverflow.com/a/70069241
// Get current tag/commit and last commit date from git
const pexec = promisify(exec);
let [version, lastmod] = (
  await Promise.allSettled([
    pexec('git fetch --tags && git describe --tags || git rev-parse --short HEAD'),
    pexec('git log -1 --format=%cd --date=format:"%Y-%m-%d %H:%M"')
  ])
).map((v) => JSON.stringify(v.value?.stdout.trim()));

/**
 * @type {import('vite').UserConfig}
 */
const config = {
  define: {
    __VERSION__: version,
    __LASTMOD__: lastmod
  },
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
    alias: {
      $src: path.resolve('./src'),
      $comps: path.resolve('./src/lib/components')
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          setupFiles: ['vitest-browser-svelte'],
          browser: {
            headless: true,
            provider: 'playwright', // or 'webdriverio'
            enabled: true,
            instances: [{ browser: 'chromium' }]
          }
        }
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          exclude: ['src/**/*.browser.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          globals: true,
          environment: 'jsdom',
          setupFiles: 'setupTest.cjs'
        }
      }
    ]
  }
};
export default config;
