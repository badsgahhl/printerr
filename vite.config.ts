import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 4300
  },

  // The shop opens the built file by double-click, so the build target is always
  // one self-contained index.html -- viteSingleFile inlines JS and CSS for that.
  plugins: [vue(), tailwindcss(), viteSingleFile()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },

  build: {
    // No source map: nobody debugs the inlined bundle, and it would double the file.
    sourcemap: false
  }
})
