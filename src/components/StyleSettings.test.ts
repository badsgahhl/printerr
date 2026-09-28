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
const openSheet = () => fireEvent.click(screen.getByRole('button', { name: /Bogen & Schild/u }))

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

  it('keeps the hole and the price position with the sheet, not with the sizes', async () => {
    renderSettings()
    await openSheet()

    expect(screen.getByLabelText('Loch oben fürs Bändchen')).toHaveAttribute('type', 'range')
    expect(screen.getByLabelText('Preis steht')).toHaveAttribute('type', 'range')
  })

  it('says how much of the hole a small label can actually grant', async () => {
    // Twenty millimetres of a sixty-fourth of A4 would be more than half the
    // tag, so the strip is capped at a third -- and says so rather than quietly
    // taking less than was asked for.
    renderSettings({ ...DEFAULT_LABEL_STYLE, columns: 8, rows: 8, punchMm: 20 })
    await openSheet()

    expect(screen.getByText(/bleiben davon 12,4 mm/u)).toBeInTheDocument()
  })

  it('says nothing about the hole when the label can grant it', async () => {
    renderSettings({ ...DEFAULT_LABEL_STYLE, punchMm: 10 })
    await openSheet()

    expect(screen.queryByText(/bleiben davon/u)).not.toBeInTheDocument()
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
