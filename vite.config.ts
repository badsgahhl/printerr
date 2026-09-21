import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  // Relative URLs so the same build works from a double-clicked file:// path and
  // from the GitHub-Pages subdirectory (/printerr/).
  base: './',

  server: {
    port: 4300
  },

  // The shop opens the built file by double-click, so the build target is always
  // one self-contained index.html -- viteSingleFile inlines JS and CSS for that.
  plugins: [vue(), tailwindcss(), viteSingleFile()],

  // .ods is not a type Vite knows; declaring it lets the app import the example
  // sheet with `?inline`, which bakes it into the bundle as a data URL.
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
