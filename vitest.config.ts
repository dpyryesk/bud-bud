import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Vite 8+ supports tsconfig path aliases natively.
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**'],
    },
  },
});
