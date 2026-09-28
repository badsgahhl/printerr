import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/*
 * The suite that needs a real browser.
 *
 * Everything in `vitest.config.ts` runs in jsdom, which reports every dimension
 * as zero -- so the one thing it can never check is the thing this app is for:
 * what a label looks like once the text has been measured and fitted. These
 * tests render the real components in Chromium and keep a screenshot of each.
 */
export default defineConfig({
  plugins: [vue()],
  // Mirrors vite.config.ts: the example spreadsheet is imported as a URL, so the
  // browser suite can print the very file the shop downloads.
  assetsInclude: ['**/*.ods'],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    include: ['src/**/*.browser.test.ts'],
    root: fileURLToPath(new URL('./', import.meta.url)),
    browser: {
      enabled: true,
      provider: playwright(),
      /*
       * Print is what this app makes, so the screenshots have to be taken in
       * print media: the cut marks are a quarter millimetre there rather than a
       * screen pixel, the preview's shadow is gone, and the measuring sandbox is
       * hidden. Only the driver can switch a page's media, hence a command.
       */
      commands: {
        emulateMedia: async ({ page }, media: 'screen' | 'print') => void (await page.emulateMedia({ media }))
      },
      headless: true,
      instances: [{ browser: 'chromium' }],
      // Room for a whole A4 sheet at 1:1, so nothing is screenshotted scrolled.
      viewport: { width: 1000, height: 1300 },
      // The matcher writes its own actual/diff pair on a mismatch; a second
      // screenshot of the whole page next to it only adds noise.
      screenshotFailures: false,
      expect: {
        toMatchScreenshot: {
          comparatorName: 'pixelmatch',
          /*
           * Text antialiasing is not bit-stable across machines, and a label is
           * mostly text. Half a percent of the pixels is far more than
           * antialiasing ever moves and far less than any real layout change:
           * a price one step smaller already repaints several percent.
           */
          comparatorOptions: { allowedMismatchedPixelRatio: 0.005 }
        }
      }
    }
  }
})
