import { describe, expect, it } from 'vitest'

import { LABEL_EXAMPLES } from '@/test/browser/examples'
import { fittedSizes, renderLabel } from '@/test/browser/harness'

import '@/assets/fonts.css'
import '@/print/label.css'

/*
 * One label per thing that can happen to a price tag, each measured for real
 * and photographed.
 *
 * The snapshot of the fitted sizes is the half that says *why* a label looks
 * the way it does; the screenshot is the half that notices when it stops
 * looking that way. Neither is possible in jsdom, which measures every text as
 * nothing at all.
 */
describe.each(LABEL_EXAMPLES)('a label with $what', ({ key, label, brand }) => {
  it('is fitted and drawn as its screenshot says', async () => {
    const { locator, fit } = await renderLabel(label, { brand })

    await expect.element(locator).toBeVisible()
    expect(fittedSizes(fit)).toMatchSnapshot('fitted sizes in px')
    await expect.element(locator).toMatchScreenshot(`label-${key}`)
  })
})
