import { computed, reactive, watch } from 'vue'

import { createSafeStorage, type SafeStorage } from '@/infra/safe-storage'
import { paginate, type PrintJob, SLOTS_PER_SHEET } from '@/lib/paginate'
import type { Label } from '@/lib/types'

/**
 * What the seller has picked, and how it lands on paper.
 *
 * Small and frequently edited, so a plain reactive object with a storage watcher
 * is the right shape here -- unlike the label library, which is written once.
 */

interface SelectionState {
  /** Label id to number of copies. Absent or zero means not selected. */
  copies: Record<string, number>
  /** Slots of the first sheet already cut away, 0-based in reading order. */
  blockedFirstSheetSlots: number[]
}

export function createSelection(deps: { storage?: SafeStorage } = {}) {
  const storage = deps.storage ?? createSafeStorage()

  const state = reactive<SelectionState>(
    storage.read<SelectionState>('selection', { copies: {}, blockedFirstSheetSlots: [] })
  )

  watch(state, () => void storage.write('selection', { ...state }), { deep: true })

  const isSelected = (id: string): boolean => (state.copies[id] ?? 0) > 0

  const copiesOf = (id: string): number => state.copies[id] ?? 0

  function setCopies(id: string, count: number): void {
    const clamped = Math.max(0, Math.trunc(count))
    if (clamped === 0) delete state.copies[id]
    else state.copies[id] = clamped
  }

  function toggle(id: string, defaultCopies = 1): void {
    if (isSelected(id)) setCopies(id, 0)
    else setCopies(id, Math.max(1, defaultCopies))
  }

  /** Apply the Drucken and Anzahl columns from a freshly imported file. */
  function applyDefaults(labels: readonly Label[]): void {
    for (const key of Object.keys(state.copies)) delete state.copies[key]
    for (const label of labels) {
      if (label.preselected) state.copies[label.id] = Math.max(1, label.copies)
    }
  }

  function selectAll(labels: readonly Label[]): void {
    for (const label of labels) state.copies[label.id] = Math.max(1, copiesOf(label.id), label.copies)
  }

  function clearSelection(): void {
    for (const key of Object.keys(state.copies)) delete state.copies[key]
  }

  function toggleBlockedSlot(slot: number): void {
    if (slot < 0 || slot >= SLOTS_PER_SHEET) return
    const index = state.blockedFirstSheetSlots.indexOf(slot)
    if (index === -1) state.blockedFirstSheetSlots.push(slot)
    else state.blockedFirstSheetSlots.splice(index, 1)
  }

  const isBlocked = (slot: number): boolean => state.blockedFirstSheetSlots.includes(slot)

  /** Jobs in sheet order, so the printout follows the seller's own list. */
  function jobsFor(labels: readonly Label[]): PrintJob[] {
    return labels
      .filter((label) => isSelected(label.id))
      .map((label) => ({ labelId: label.id, copies: copiesOf(label.id) }))
  }

  function planFor(labels: readonly Label[]) {
    return paginate(jobsFor(labels), { blockedFirstSheetSlots: state.blockedFirstSheetSlots })
  }

  return {
    state,
    isSelected,
    copiesOf,
    setCopies,
    toggle,
    applyDefaults,
    selectAll,
    clearSelection,
    toggleBlockedSlot,
    isBlocked,
    jobsFor,
    planFor,
    selectedCount: computed(() => Object.values(state.copies).filter((count) => count > 0).length),
    labelCount: computed(() => Object.values(state.copies).reduce((total, count) => total + count, 0))
  }
}

export type SelectionStore = ReturnType<typeof createSelection>

export const selection = createSelection()
