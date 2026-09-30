import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // The migration tests boot Postgres (PGlite) once per file.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Modules that import the Supabase client create it as they load. Tests
    // never reach the network, so a placeholder project keeps them working
    // without .env.local (CI has none) and away from the real dev project.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
