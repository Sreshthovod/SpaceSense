/**
 * Undo/redo around designReducer. Only design edits pass through here; the camera, selection, open
 * panels and view mode live elsewhere, so they never create history entries.
 *
 * - An edit that changes nothing is not recorded.
 * - Edits carrying the same `coalesce` key within COALESCE_MS (e.g. a slider being dragged, a colour
 *   picker, typing a size) merge into one step. Drags already commit once, on release.
 * - At most MAX_HISTORY steps are kept.
 */
import { designReducer } from './reducer'

export const MAX_HISTORY = 100
export const COALESCE_MS = 500

export const initHistory = (design) => ({ past: [], present: design, future: [], last: null })

export function historyReducer(state, action) {
  switch (action.type) {
    case 'undo': {
      if (!state.past.length) return state
      const previous = state.past[state.past.length - 1]
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], last: null }
    }
    case 'redo': {
      if (!state.future.length) return state
      const [next, ...rest] = state.future
      return { past: [...state.past, state.present], present: next, future: rest, last: null }
    }
    case 'clearHistory':
      return initHistory(state.present)
    default: {
      const next = designReducer(state.present, action)
      if (next === state.present) return state
      const at = action.at ?? 0
      const merge = action.coalesce && state.last?.key === action.coalesce && at - state.last.at <= COALESCE_MS
      if (merge) return { ...state, present: next, future: [], last: { key: action.coalesce, at } }
      const past = [...state.past, state.present].slice(-MAX_HISTORY)
      return { past, present: next, future: [], last: action.coalesce ? { key: action.coalesce, at } : null }
    }
  }
}
