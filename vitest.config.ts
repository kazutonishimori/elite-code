import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}', 'scripts/lib/**/*.ts', 'build/**/*.ts'],
        exclude: [
          '**/*.test.{ts,tsx}',
          'src/test/**',
          'src/types/**',
          'src/main.tsx',
          'src/components/ui/**',
          // Thin browser-only glue: exercised by the Playwright suite instead.
          'src/runner/worker/pyodide.worker.ts',
          'src/runner/browserRunner.ts',
          'src/lib/monaco.ts',
          'src/lib/monacoSlim.ts',
          'src/components/editor/MonacoEditors.tsx',
          // Spawns real processes: covered by tests/integration instead.
          'scripts/lib/cpythonRunner.ts',
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
            include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'build/**/*.test.ts'],
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
