import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

const SRC_TEST_GLOB = 'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}';
const BROWSER_TEST_GLOB = 'src/**/*.browser.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}';
const DOM_EXCLUDES = [
  BROWSER_TEST_GLOB,
  'e2e/**/*',
  'tests/**/*',
  'tests-examples/**/*'
];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      plugins: [svelte()],
            name: 'dom',
            globals: true,
            setupFiles: 'setupTest.cjs',
            include: [SRC_TEST_GLOB],
            exclude: DOM_EXCLUDES,
            environment: 'jsdom'
    }
  })
);
