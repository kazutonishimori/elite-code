import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/types/**',
          'src/main.tsx',
          'src/components/ui/**',
          // Thin browser-only glue: exercised by the Playwright suite instead.
          'src/runner/worker/pyodide.worker.ts',
          'src/runner/browserWorkerFactory.ts',
          'src/lib/monaco.ts',
          'scripts/pyodide-assets.ts',
        ],
        reporter: ['text-summary', 'html', 'json-summary'],
        thresholds: {
          lines: 80,
          branches: 80,
          functions: 80,
          statements: 80,
          'src/core/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
          'src/runner/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        },
      },
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
            environment: 'jsdom',
            setupFiles: ['src/test/setup.ts'],
            restoreMocks: true,
          },
        },
        {
          extends: true,
          test: {
            name: 'integration',
            include: ['tests/integration/**/*.test.ts'],
            environment: 'node',
            testTimeout: 120_000,
            hookTimeout: 120_000,
            fileParallelism: false,
          },
        },
      ],
    },
  }),
);
