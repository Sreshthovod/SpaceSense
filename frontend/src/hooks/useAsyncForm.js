import { useCallback, useRef, useState } from 'react'

/**
 * Runs one submit at a time and keeps the pending flag and the error (with the field it belongs to).
 * `run(fn)` resolves to fn's result, or to undefined when it failed (the error is then in `error`).
 */
export default function useAsyncForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null) // { message, field }
  const inFlight = useRef(false)

  const run = useCallback(async (fn) => {
    if (inFlight.current) return undefined
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError({ message: err.message || 'Something went wrong. Please try again.', field: err.field || '' })
      return undefined
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [])

  return { pending, error, run, clearError: () => setError(null) }
}
