import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative URLs, so the build works from the GitHub-Pages subdirectory
  // (/printerr/) without hard-coding it.
  base: './',

  server: {
    port: 4300
  },

  plugins: [vue(), tailwindcss()],

  // .ods is not a type Vite knows; declaring it lets the app import the example
  // sheet and get a URL for it.
  assetsInclude: ['**/*.ods'],

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
