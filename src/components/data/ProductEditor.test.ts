import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import ProductEditor from '@/components/data/ProductEditor.vue'
import { catalogState } from '@/composables/use-catalog'
import type { Part, Product } from '@/lib/catalog/types'

/**
 * The editor drives the shared catalogue singleton, the same one the app uses.
 * Each test starts from an empty one so nothing leaks between them.
 */

const part = (id: string, over: Partial<Part> = {}): Part => ({
  id,
  name: `Teil ${id}`,
  artNr: null,
  priceCents: 12_900,
  priceText: null,
  ...over
})

const product = (id: string, over: Partial<Product> = {}): Product => ({
  id,
  name: `Produkt ${id}`,
  subtitle: null,
  artNr: null,
  priceCents: 89_000,
  priceNote: null,
  note: null,
  copies: 1,
  preselected: true,
  layout: null,
  parts: [],
  sortIndex: 0,
  ...over
})

afterEach(async () => {
  await catalogState.clearAll()
})

describe('the product list', () => {
  it('invites the shop to start when there is nothing yet', () => {
    render(ProductEditor)

    expect(screen.getByText(/Noch keine Produkte/u)).toBeInTheDocument()
  })

  it('lists what the catalogue holds', () => {
    catalogState.saveProduct(product('p1', { name: 'Mühle', artNr: '4711' }))
    render(ProductEditor)

    expect(screen.getByText('Mühle')).toBeInTheDocument()
    expect(screen.getByText('4711')).toBeInTheDocument()
  })

  it('summarises the add-ons, calling out what is on display', () => {
    catalogState.savePart(part('t1'))
    catalogState.saveProduct(
      product('p1', {
        parts: [
          { partId: 't1', exhibited: true, priceCentsOverride: null, priceTextOverride: null },
          { partId: 't2', exhibited: false, priceCentsOverride: null, priceTextOverride: null }
        ]
      })
    )
    render(ProductEditor)

    expect(screen.getByText('2 Teile, 1 ausgestellt')).toBeInTheDocument()
  })

  it('filters by name and by article number', async () => {
    const user = userEvent.setup()
    catalogState.saveProduct(product('p1', { name: 'Mühle', artNr: '4711' }))
    catalogState.saveProduct(product('p2', { name: 'Engel', artNr: '2201', sortIndex: 1 }))
    render(ProductEditor)

    await user.type(screen.getByPlaceholderText('Produkte durchsuchen'), 'engel')

    expect(screen.queryByText('Mühle')).not.toBeInTheDocument()
    expect(screen.getByText('Engel')).toBeInTheDocument()
  })
})

describe('editing a product', () => {
  it('opens with the stored values and saves changes back', async () => {
    const user = userEvent.setup()
    catalogState.saveProduct(product('p1', { name: 'Mühle' }))
    render(ProductEditor)

    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }))
    const name = screen.getByLabelText('Name')
    expect(name).toHaveValue('Mühle')

    await user.clear(name)
    await user.type(name, 'Mühle "Seiffen"')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(catalogState.products.value[0]?.name).toBe('Mühle "Seiffen"')
  })

  it('refuses to save a product with no name', async () => {
    const user = userEvent.setup()
    render(ProductEditor)

    await user.click(screen.getByRole('button', { name: /Neues Produkt/u }))

    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled()
  })

  it('shows what the label will print while the form is still open', async () => {
    // The exhibition price is the thing people get wrong; seeing it live is the
    // point of editing here rather than in a spreadsheet.
    const user = userEvent.setup()
    catalogState.savePart(part('t1', { name: 'Bergmann', priceCents: 12_900 }))
    catalogState.saveProduct(
      product('p1', {
        priceCents: 89_000,
        parts: [{ partId: 't1', exhibited: true, priceCentsOverride: null, priceTextOverride: null }]
      })
    )
    render(ProductEditor)

    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }))

    expect(screen.getByText(/1\.019,00/u)).toBeInTheDocument()
    expect(screen.getByText(/wie ausgestellt/u)).toBeInTheDocument()
  })

  it('detaches a part without deleting it from the catalogue', async () => {
    const user = userEvent.setup()
    catalogState.savePart(part('t1', { name: 'Bergmann' }))
    catalogState.saveProduct(
      product('p1', { parts: [{ partId: 't1', exhibited: true, priceCentsOverride: null, priceTextOverride: null }] })
    )
    render(ProductEditor)

    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }))
    const row = screen.getByText('Bergmann').closest('div')!
    await user.click(within(row).getAllByRole('button').at(-1)!)
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(catalogState.products.value[0]?.parts).toEqual([])
    expect(catalogState.parts.value.map((entry) => entry.name)).toEqual(['Bergmann'])
  })

  it('creates a part and attaches it in one step', async () => {
    // Leaving the dialog to create a figure would make adding one a chore.
    const user = userEvent.setup()
    catalogState.saveProduct(product('p1'))
    render(ProductEditor)

    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }))
    await user.type(screen.getByLabelText(/neues Teil anlegen/u), 'Engel')
    await user.click(screen.getByRole('button', { name: 'Anlegen' }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(catalogState.parts.value.map((entry) => entry.name)).toEqual(['Engel'])
    expect(catalogState.products.value[0]?.parts).toHaveLength(1)
  })

  it('discards changes when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    catalogState.saveProduct(product('p1', { name: 'Mühle' }))
    render(ProductEditor)

    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Verworfen')
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(catalogState.products.value[0]?.name).toBe('Mühle')
  })
})
