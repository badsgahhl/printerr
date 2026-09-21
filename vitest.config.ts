import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'

// Tailwind is deliberately absent here: no test asserts on utility classes, and
// skipping the plugin keeps the suite fast.
export default defineConfig({
  plugins: [vue()],
  // Mirrors vite.config.ts: the drop zone imports the example .ods as a data URL.
  assetsInclude: ['**/*.ods'],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...configDefaults.exclude, 'dist/**'],
    root: fileURLToPath(new URL('./', import.meta.url))
  }
})
