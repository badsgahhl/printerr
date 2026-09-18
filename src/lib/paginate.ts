/**
 * Turning a selection into sheets of paper.
 *
 * Pure on purpose: the browser must never decide where a page break falls.
 * Grid and flex layouts have long-standing fragmentation bugs, so the app hands
 * the printer one block element per A4 sheet with exactly four slots filled in.
 */

export const SLOTS_PER_SHEET = 4

export interface PrintJob {
  readonly labelId: string
  readonly copies: number
}

export type Slot =
  | { readonly kind: 'label'; readonly labelId: string; readonly copyIndex: number }
  /** 'blocked' was already cut off the sheet, 'padding' is simply left over. */
  | { readonly kind: 'empty'; readonly reason: 'blocked' | 'padding' }

export interface SheetPlan {
  readonly index: number
  readonly slots: readonly Slot[]
}

export interface PaginateOptions {
  /**
   * Slots of the first sheet that are already used up, 0-based, reading order.
   *
   * Not a start offset: a part-used sheet can be missing any combination of
   * labels, not just a run from the top left.
   */
  readonly blockedFirstSheetSlots?: readonly number[]
  readonly slotsPerSheet?: number
}

export function expandJobs(jobs: readonly PrintJob[]): readonly { labelId: string; copyIndex: number }[] {
  const items: { labelId: string; copyIndex: number }[] = []
  for (const job of jobs) {
    for (let copyIndex = 0; copyIndex < job.copies; copyIndex += 1) {
      items.push({ labelId: job.labelId, copyIndex })
    }
  }
  return items
}

export function paginate(jobs: readonly PrintJob[], options: PaginateOptions = {}): readonly SheetPlan[] {
  const perSheet = options.slotsPerSheet ?? SLOTS_PER_SHEET
  const items = expandJobs(jobs)
  if (items.length === 0) return []

  let blocked = new Set((options.blockedFirstSheetSlots ?? []).filter((slot) => slot >= 0 && slot < perSheet))

  const sheets: SheetPlan[] = []
  let cursor = 0

  while (cursor < items.length) {
    const slots: Slot[] = []
    let placed = 0

    for (let slot = 0; slot < perSheet; slot += 1) {
      if (blocked.has(slot)) {
        slots.push({ kind: 'empty', reason: 'blocked' })
        continue
      }
      const item = items[cursor]
      if (item) {
        slots.push({ kind: 'label', labelId: item.labelId, copyIndex: item.copyIndex })
        cursor += 1
        placed += 1
      } else {
        slots.push({ kind: 'empty', reason: 'padding' })
      }
    }

    // Only the first sheet can be part-used; every following one is fresh.
    // Clearing this also guarantees the loop terminates.
    blocked = new Set()

    // A sheet with every slot blocked would print a blank page.
    if (placed > 0) sheets.push({ index: sheets.length, slots })
  }

  return sheets
}
