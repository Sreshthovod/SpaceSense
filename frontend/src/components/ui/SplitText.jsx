import { Fragment } from 'react'

/**
 * Splits a line into words that slide up out of a mask one after another. The words are hidden from
 * assistive tech, so give the parent heading `aria-label` with the full text. Inside a `.reveal` the
 * words play when it scrolls into view; with `onLoad` they play straight away (the hero).
 * `start` offsets this line's stagger so two lines can follow each other.
 */
export default function SplitText({ text, onLoad = false, start = 0 }) {
  const words = text.split(' ')
  return (
    <span aria-hidden="true" className={onLoad ? 'split split-load' : 'split'}>
      {/* The space goes between the word boxes: inside an inline-block, trailing spaces collapse. */}
      {words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className="split-word"><span style={{ '--i': start + i }}>{w}</span></span>
        </Fragment>
      ))}
    </span>
  )
}
