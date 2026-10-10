import { useLayoutEffect, useRef, useState } from 'react'

/**
 * The ink pill behind the pressed button of a segmented control, gliding between buttons of any width.
 * Render it as the first child of a `relative` group whose buttons use `aria-pressed`; `active` is
 * whatever identifies the pressed button (so it re-measures when that changes). It finds the group
 * through its own element, because a parent's ref isn't attached yet when a child's layout effect runs.
 */
export default function SlidingHighlight({ active }) {
  const ref = useRef(null)
  const [box, setBox] = useState(null)

  useLayoutEffect(() => {
    const group = ref.current?.parentElement
    if (!group) return undefined
    const measure = () => {
      const on = group.querySelector('[aria-pressed="true"]')
      setBox(on ? { left: on.offsetLeft, top: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight } : null)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(group)
    return () => ro.disconnect()
  }, [active])

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 rounded-full bg-ink transition-[transform,width] duration-300 ease-[var(--ease-out)]"
      style={box
        ? { width: box.width, height: box.height, transform: `translate(${box.left}px, ${box.top}px)` }
        : { opacity: 0 }}
    />
  )
}
