import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: preprocess({ postcss: true }),

  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: null,
      compress: true
    }),
    inlineStyleThreshold: 1024,
    alias: {
      '$src/*': 'src/*',
      '$comps/*': 'src/components/*',
      $lib: 'src/lib',
      '$lib/*': 'src/lib/*'
    }
  }
};

export default config;
