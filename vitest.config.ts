import { defineConfig } from 'vitest/config'
export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'] },
  esbuild: { jsx: 'automatic' },
  test: { include: ['tests/**/*.test.{ts,tsx,mjs}'] },
})
