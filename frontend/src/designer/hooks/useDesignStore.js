import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { historyReducer, initHistory } from '../model/history'
import { writeDraft } from '../model/storage'

export const AUTOSAVE_MS = 800

/**
 * The design with undo/redo, plus a draft autosaved to this browser after real changes.
 * Nothing is written until the design actually changes, so opening the designer never overwrites
 * the previous session's draft before the user decides whether to recover it.
 */
export default function useDesignStore(initialDesign, meta) {
  const [state, rawDispatch] = useReducer(historyReducer, initialDesign, initHistory)
  const [saveStatus, setSaveStatus] = useState({ savedAt: null, error: '' })
  const metaRef = useRef(meta)
  useEffect(() => { metaRef.current = meta }, [meta])

  // Coalescing edits need a time; reducers stay pure, so it's stamped here.
  const dispatch = useCallback((action) => rawDispatch(action.coalesce ? { ...action, at: Date.now() } : action), [])
  const undo = useCallback(() => rawDispatch({ type: 'undo' }), [])
  const redo = useCallback(() => rawDispatch({ type: 'redo' }), [])
  const clearHistory = useCallback(() => rawDispatch({ type: 'clearHistory' }), [])

  const design = state.present
  const latest = useRef(design)
  const dirty = design !== initialDesign

  const save = useCallback(() => {
    try {
      writeDraft(latest.current, metaRef.current || {})
      setSaveStatus({ savedAt: new Date(), error: '' })
    } catch (err) {
      setSaveStatus((s) => ({ ...s, error: err.message }))
    }
  }, [])

  useEffect(() => {
    latest.current = design
    if (!dirty) return undefined
    const timer = setTimeout(save, AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [design, dirty, save])

  // Don't lose the last few hundred milliseconds of work when the tab closes or the designer does.
  useEffect(() => {
    const flush = () => { if (latest.current !== initialDesign) save() }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [save, initialDesign])

  return {
    design,
    dispatch,
    undo,
    redo,
    clearHistory,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    saveStatus,
  }
}
