import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/vue'
import { afterEach } from 'vitest'

// Testing Library only registers its own cleanup when vitest runs with
// `globals: true`, which this project doesn't -- without this a component left
// mounted by one test answers the next test's queries, and the failure points
// at the wrong test.
afterEach(cleanup)
