import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import App from '@/App.vue'
import { KEY_PREFIX } from '@/infra/safe-storage'

afterEach(() => localStorage.clear())

describe('the workspace switch', () => {
  it('starts on the print side', () => {
    render(App)

    expect(screen.getByRole('tab', { name: /Drucken/u })).toHaveAttribute('aria-selected', 'true')
  })

  it('restores the tab that was last used', () => {
    localStorage.setItem(`${KEY_PREFIX}mode`, 'data')
    render(App)

    expect(screen.getByRole('tab', { name: /Daten/u })).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to printing when the stored value makes no sense', () => {
    // Both workspaces are toggled with v-show, so an unknown value would hide
    // both and leave an empty window with no way back. Local storage is shared
    // between every file:// page in Chrome and outlives app versions.
    localStorage.setItem(`${KEY_PREFIX}mode`, '"data"')
    render(App)

    expect(screen.getByRole('tab', { name: /Drucken/u })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows both headings whatever is stored', () => {
    localStorage.setItem(`${KEY_PREFIX}mode`, 'volliger unsinn')
    render(App)

    expect(screen.getByRole('tab', { name: /Drucken/u })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Daten/u })).toBeInTheDocument()
  })
})
