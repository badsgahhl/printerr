import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import StyleSettings from '@/components/StyleSettings.vue'
import { DEFAULT_LABEL_STYLE, type LabelStyle } from '@/print/geometry'

function renderSettings(labelStyle: LabelStyle = DEFAULT_LABEL_STYLE) {
  const isDefault = (keys: readonly (keyof LabelStyle)[]): boolean =>
    keys.every((key) => labelStyle[key] === DEFAULT_LABEL_STYLE[key])
  return render(StyleSettings, { props: { labelStyle, isDefault } })
}

const openSizes = () => fireEvent.click(screen.getByRole('button', { name: /Schriftgrößen/u }))

describe('StyleSettings', () => {
  it('offers a size for every text on the label, named as in the product form', async () => {
    renderSettings()
    await openSizes()

    for (const name of [
      'Produktname',
      'Untertitel',
      'Artikelnummer',
      'Preis',
      'Preiszusatz',
      'Zusätze',
      'Hinweis am Fuß',
      'Ladenname'
    ]) {
      expect(screen.getByLabelText(name)).toHaveAttribute('type', 'range')
    }
  })

  it('changes only the text whose slider was moved', async () => {
    const { emitted } = renderSettings()
    await openSizes()

    await fireEvent.input(screen.getByLabelText('Hinweis am Fuß'), { target: { value: '28' } })

    expect(emitted('change')).toEqual([['noteMaxPx', 28]])
  })

  it('shows what the size comes to on paper', async () => {
    renderSettings({ ...DEFAULT_LABEL_STYLE, noteMaxPx: 30 })
    await openSizes()

    // 30px at 96dpi is 7.9mm.
    const slider = screen.getByLabelText('Hinweis am Fuß')
    expect(slider.parentElement?.textContent).toContain('7,9 mm')
  })

  it('puts a single changed size back without touching the rest', async () => {
    const { emitted } = renderSettings({ ...DEFAULT_LABEL_STYLE, noteMaxPx: 30 })
    await openSizes()

    // Only the slider that was moved offers to go back.
    expect(screen.getAllByRole('button', { name: /auf Standard/u })).toHaveLength(1)

    await fireEvent.click(screen.getByRole('button', { name: 'Hinweis am Fuß auf Standard' }))

    expect(emitted('reset')).toEqual([[['noteMaxPx']]])
  })

  it('resets the sizes and the sheet separately', async () => {
    const { emitted } = renderSettings({ ...DEFAULT_LABEL_STYLE, noteMaxPx: 30 })

    // The sheet is untouched, so only the sizes offer a reset.
    const resets = screen.getAllByRole('button', { name: 'zurücksetzen' })
    expect(resets).toHaveLength(1)

    await fireEvent.click(resets[0]!)
    const [[keys]] = emitted('reset') as [[readonly string[]]]
    expect(keys).toContain('noteMaxPx')
    expect(keys).not.toContain('columns')
  })
})
