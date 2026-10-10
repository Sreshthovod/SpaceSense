// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import SlidingHighlight from './SlidingHighlight'

afterEach(cleanup)

function Group() {
  const [on, setOn] = useState('a')
  return (
    <div role="group" className="relative">
      <SlidingHighlight active={on} />
      {['a', 'b'].map((id) => <button key={id} type="button" aria-pressed={on === id} onClick={() => setOn(id)}>{id}</button>)}
    </div>
  )
}

describe('SlidingHighlight', () => {
  it('is measured on the very first render (not only after a click)', () => {
    render(<Group />)
    const pill = screen.getByRole('group').firstElementChild
    expect(pill.style.opacity).toBe('') // a hidden pill would be opacity 0
    expect(pill.style.transform).toMatch(/^translate\(/)
    fireEvent.click(screen.getByRole('button', { name: 'b' }))
    expect(pill.style.opacity).toBe('')
  })
})
