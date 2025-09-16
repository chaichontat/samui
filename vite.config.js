import path from 'path';
import { searchForWorkspaceRoot } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { exec } from 'child_process';
import { promisify } from 'util';
import rollupNative from 'rollup-plugin-natives';

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
  plugins: [sveltekit(), rollupNative({copyTo: ".vite/build", destDir:"./"})],
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
    chunkSizeWarningLimit: 1024,
    ssrEmitAssets: true,
  },
  assetsInclude:['**/*.node'],
  optimizeDeps: {exclude: ["fsevents"]},
};
export default config;
