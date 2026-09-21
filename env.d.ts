/// <reference types="vite/client" />

/**
 * Importing the example sheet yields a URL for it.
 *
 * Vite is told about the extension via `assetsInclude`, but TypeScript still
 * needs to be told what the import evaluates to.
 */
declare module '*.ods' {
  const src: string
  export default src
}
