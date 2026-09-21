import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/vue'
import { afterEach } from 'vitest'

// Testing Library only registers its own cleanup when vitest runs with
// `globals: true`, which this project doesn't -- without this a component left
// mounted by one test answers the next test's queries, and the failure points
// at the wrong test.
afterEach(cleanup)

/*
 * jsdom implements none of the following, and the reka-ui primitives behind the
 * shadcn Dialog, Select and Tabs reach for all of them while measuring,
 * positioning and trapping focus. Missing, they throw the moment a dialog opens.
 *
 * Plain stubs rather than vi.fn(): nothing asserts on these calls, so a spy
 * would only suggest they matter.
 */
const noop = (): void => {}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    // Answer "yes" to width queries so components that branch on a breakpoint
    // render their desktop shape.
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => false
  })
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

window.IntersectionObserver ??= class {
  root = null
  rootMargin = ''
  thresholds = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
} as unknown as typeof IntersectionObserver

Element.prototype.scrollIntoView ??= noop
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= noop
Element.prototype.releasePointerCapture ??= noop
