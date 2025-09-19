import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';
import vitest from 'eslint-plugin-vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import svelteConfig from './svelte.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/build/**',
      '**/.svelte-kit/**',
      'gdal3.js/**',
      'loopy/**',
      'scripts/**',
      'docker/**',
      'static/**',
      '*.cjs',
      'svelte.config.js',
      'vite.config.js'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.{ts,js}'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
        projectService: true,
        tsconfigRootDir: __dirname,
        svelteConfig
      }
    },
    settings: {
      svelte: {
        kit: {
          files: {
            routes: 'src/routes'
          }
        }
      }
    }
  },
  {
    files: ['**/*.test.{ts,js}', '**/__tests__/**/*.{ts,js}'],
    plugins: {
      vitest
    },
    rules: {
      ...vitest.configs.recommended.rules
    }
  },
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/sort-type-constituents': 'off'
    }
  },
  eslintConfigPrettier
);
