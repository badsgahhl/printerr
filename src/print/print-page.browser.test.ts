import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-vue'

import PrintPreview from '@/components/PrintPreview.vue'
import { paginate } from '@/lib/paginate'
import { DEFAULT_LABEL_STYLE, SHEET_HEIGHT_MM, slotsPerSheet } from '@/print/geometry'
import { fillSheet } from '@/test/browser/examples'
import { fitsFor, printMedia, screenMedia } from '@/test/browser/harness'

import '@/assets/fonts.css'
import '@/print/label.css'
import '@/print/print.css'

/*
 * The rules that decide how many pages come out of the printer.
 *
 * `print-css.test.ts` reads these out of the stylesheet as text, which catches
 * someone deleting them. Only a browser can say whether they actually apply to
 * the elements they were written for -- and every one of them was, at some
 * point, a sheet of paper wasted in the shop.
 */

const MM = 96 / 25.4

afterEach(() => screenMedia())

async function renderTwoSheets() {
  const container = document.createElement('div')
  container.id = 'app'
  document.body.append(container)

  // Enough labels for two sheets, in the structure the app prints: a scroller
  // holding a .sheet-list of .sheet-scaler wrappers.
  const labels = fillSheet(slotsPerSheet(DEFAULT_LABEL_STYLE) + 2)
  const fits = await fitsFor(labels)
  const sheets = paginate(
    labels.map((label) => ({ labelId: label.id, copies: 1 })),
    { slotsPerSheet: slotsPerSheet(DEFAULT_LABEL_STYLE) }
  )

  const screen = await render(PrintPreview, {
    container,
    props: {
      sheets,
      labels,
      fitFor: (id: string) => fits.get(id),
      brand: null,
      showRuler: false,
      labelStyle: DEFAULT_LABEL_STYLE,
      priceFormat: {}
    }
  })

  expect(sheets).toHaveLength(2)
  return screen
}

describe('a printout of two sheets', () => {
  it('breaks before each following sheet and never after the last', async () => {
    const screen = await renderTwoSheets()
    await printMedia()

    const [first, second] = [...screen.container.querySelectorAll<HTMLElement>('.sheet-scaler')]

    // A break after the last sheet is how Firefox is talked into an empty page.
    expect(getComputedStyle(first!).breakBefore).toBe('auto')
    expect(getComputedStyle(first!).breakAfter).toBe('auto')
    expect(getComputedStyle(second!).breakBefore).toBe('page')
    expect(getComputedStyle(second!).breakAfter).toBe('auto')
  })

  it('keeps a sheet a hair under the page, and nothing standing beside it', async () => {
    const screen = await renderTwoSheets()
    // The preview shrinks the sheet with a transform, which `getBoundingClientRect`
    // reports and `offsetHeight` does not: on screen the sheet is laid out at
    // its full height and only drawn smaller.
    const onScreen = screen.container.querySelector<HTMLElement>('.sheet')!.offsetHeight / MM

    await printMedia()
    const sheets = [...screen.container.querySelectorAll<HTMLElement>('.sheet')]
    const list = screen.container.querySelector<HTMLElement>('.sheet-list')!

    expect(onScreen).toBeCloseTo(SHEET_HEIGHT_MM, 0)
    // A quarter millimetre short: drivers that report A4 as 11.69 inch would
    // otherwise move the sheet to a page of its own and leave this one blank.
    for (const sheet of sheets) {
      // No transform in print, so the drawn box is the laid-out box.
      expect(sheet.getBoundingClientRect().height / MM).toBeCloseTo(SHEET_HEIGHT_MM - 0.25, 2)
      expect(sheet.getBoundingClientRect().height).toBeLessThan(sheets[0]!.offsetHeight + 1)
      expect(getComputedStyle(sheet).boxShadow).toBe('none')
    }
    // No screen spacing survives: 16px between sheets is 4mm of a 297mm page.
    expect(getComputedStyle(list).rowGap).toBe('0px')
    expect(getComputedStyle(list).paddingTop).toBe('0px')
  })

  it('leaves nothing of the app beside the sheets, teleported or not', async () => {
    const screen = await renderTwoSheets()
    const dialog = document.createElement('div')
    dialog.textContent = 'ein offener Dialog'
    document.body.append(dialog)
    const chrome = document.createElement('div')
    chrome.className = 'app-chrome'
    screen.container.append(chrome)

    await printMedia()

    expect(getComputedStyle(dialog).display).toBe('none')
    expect(getComputedStyle(chrome).display).toBe('none')

    dialog.remove()
  })

  it('draws the cut marks in millimetres on paper and in pixels on screen', async () => {
    const screen = await renderTwoSheets()
    const cut = screen.container.querySelector<HTMLElement>('.sheet__cut--v')!

    expect(getComputedStyle(cut).borderLeftWidth).toBe('1px')

    await printMedia()

    // 0.25mm is 0.94px, which the browser rounds to a whole device pixel; what
    // matters is that it is a border at all, since backgrounds do not print.
    expect(getComputedStyle(cut).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(Number.parseFloat(getComputedStyle(cut).borderLeftWidth)).toBeGreaterThan(0)
    expect(getComputedStyle(cut).borderLeftColor).toBe('rgb(153, 153, 153)')
  })

  it('shows the seller the same sheets, only smaller', async () => {
    const screen = await renderTwoSheets()
    const preview = screen.container.firstElementChild as HTMLElement
    const scaler = screen.container.querySelector<HTMLElement>('.sheet-scaler')!

    /*
     * The preview scales itself to whatever room it is given, and the app gives
     * it the window. A test window would make the screenshot depend on the
     * screen it was taken on, so the room is stated here instead.
     *
     * Tailwind is not loaded in this suite -- the print components do not need
     * it -- so the utility classes that would size the scroller are inert.
     */
    preview.style.height = '600px'
    preview.style.overflow = 'auto'

    // A transform reserves no space of its own, so the wrapper claims the
    // scaled size as layout; waiting for that is waiting for the scale.
    await expect.poll(() => scaler.getBoundingClientRect().height).toBeLessThan(600)

    await expect.element(screen.locator).toMatchScreenshot('preview-two-sheets')
  })
})
