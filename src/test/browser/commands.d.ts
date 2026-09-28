/** The command declared in vitest.browser.config.ts, typed for the tests. */
declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateMedia(media: 'screen' | 'print'): Promise<void>
  }
}

export {}
