import adapter from '@sveltejs/adapter-static';
import path from 'path';
import preprocess from 'svelte-preprocess';
import { searchForWorkspaceRoot } from 'vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: preprocess({ postcss: true }),

  kit: {
    vite: {
      resolve: {
        alias: {
          $src: path.resolve('./src'),
          $comps: path.resolve('./src/lib/components'),
          $lib: path.resolve('./src/lib')
        }
      },
      server: {
        fs: {
          allow: [searchForWorkspaceRoot(process.cwd())]
        }
      },
      build: {
        chunkSizeWarningLimit: 1024,
        rollupOptions: {
          output: {
            manualChunks: {
              'chart.js': ['chart.js'],
              // 'vega-embed': ['vega-embed'],
              'lru-cache': ['lru-cache'],
              ol: ['ol'],
              'tippy.js': ['tippy.js']
            }
          }
        }
      }
    },

    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: null,
      compress: true
    }),

    prerender: {
      default: true,
      crawl: true
    }
  }
};

export default config;
