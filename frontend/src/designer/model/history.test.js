import { describe, expect, it } from 'vitest'
import { createDesign } from './design'
import { COALESCE_MS, MAX_HISTORY, historyReducer, initHistory } from './history'

const form = { width: '12', length: '16', height: '9', budget: '40000' }
const run = (state, actions) => actions.reduce((s, a) => historyReducer(s, a), state)

// Every kind of design edit, in an order where each one changes something.
const EDITS = [
  { type: 'addFloorItem', uid: 'sofa', catalogId: 'sofa' },
  { type: 'addFloorItem', uid: 'rug', catalogId: 'rug' },
  { type: 'addWallItem', uid: 'art', wall: 'left', catalogId: 'painting' },
  { type: 'updatePlaced', uid: 'sofa', changes: { x: 1, z: 0 } },
  { type: 'updatePlaced', uid: 'sofa', changes: { rotation: 90 } },
  { type: 'updatePlaced', uid: 'rug', changes: { scale: 1.5 } },
  { type: 'duplicatePlaced', uid: 'art', newUid: 'art2' },
  { type: 'removePlaced', uid: 'art2' },
  { type: 'setProduct', uid: 'sofa', productId: 'ikea-kivik-sofa' },
  { type: 'setWallColor', wall: 'back', color: '#c5cdb6' },
  { type: 'setFloor', material: 'marble' },
  { type: 'setDimension', key: 'width', value: 14 },
  { type: 'setDimensionSource', key: 'height', source: 'estimated' },
  { type: 'setItemFlags', uid: 'rug', label: 'Living rug' },
  { type: 'setItemFlags', uid: 'rug', hidden: true },
  { type: 'setItemFlags', uid: 'sofa', locked: true },
  { type: 'setBudget', value: 55000 },
  { type: 'setStyle', style: 'boho' },
  { type: 'resetWall', wall: 'left' },
  { type: 'replaceDesign', design: createDesign({ form: { width: '20' } }) },
]

describe('historyReducer', () => {
  it('undoes and redoes every kind of edit back to identical states', () => {
    const snapshots = [createDesign({ form })]
    let state = initHistory(snapshots[0])
    for (const action of EDITS) {
      const next = historyReducer(state, action)
      expect(next.present, action.type).not.toBe(state.present)
      state = next
      snapshots.push(state.present)
    }
    for (let i = EDITS.length - 1; i >= 0; i--) {
      state = historyReducer(state, { type: 'undo' })
      expect(state.present).toEqual(snapshots[i])
    }
    expect(historyReducer(state, { type: 'undo' })).toBe(state)
    for (let i = 1; i <= EDITS.length; i++) {
      state = historyReducer(state, { type: 'redo' })
      expect(state.present).toEqual(snapshots[i])
    }
    expect(historyReducer(state, { type: 'redo' })).toBe(state)
  })

  it('does not record edits that change nothing', () => {
    const state = initHistory(createDesign({ form }))
    const same = run(state, [{ type: 'setDimension', key: 'width', value: 12 }, { type: 'removePlaced', uid: 'nope' }])
    expect(same).toBe(state)
  })

  it('merges rapid edits with the same coalesce key into one step', () => {
    let state = run(initHistory(createDesign({ form })), [{ type: 'addFloorItem', uid: 'rug', catalogId: 'rug' }])
    for (let i = 0; i < 10; i++) {
      state = historyReducer(state, { type: 'updatePlaced', uid: 'rug', changes: { scale: 1 + i / 10 }, coalesce: 'scale:rug', at: i * 50 })
    }
    expect(state.past).toHaveLength(2)
    state = historyReducer(state, { type: 'updatePlaced', uid: 'rug', changes: { scale: 0.5 }, coalesce: 'scale:rug', at: 450 + COALESCE_MS + 1 })
    expect(state.past).toHaveLength(3)
    state = historyReducer(state, { type: 'undo' })
    expect(state.present.items[0].scale).toBe(1.9)
  })

  it('a new edit clears redo, and history is capped', () => {
    let state = initHistory(createDesign({ form }))
    for (let i = 0; i < MAX_HISTORY + 20; i++) state = historyReducer(state, { type: 'setBudget', value: 1000 + i })
    expect(state.past).toHaveLength(MAX_HISTORY)
    state = historyReducer(state, { type: 'undo' })
    expect(state.future).toHaveLength(1)
    state = historyReducer(state, { type: 'setStyle', style: 'industrial' })
    expect(state.future).toHaveLength(0)
  })

  it('locked items ignore moves and deletes until unlocked', () => {
    let state = run(initHistory(createDesign({ form })), [
      { type: 'addFloorItem', uid: 's', catalogId: 'sofa' },
      { type: 'setItemFlags', uid: 's', locked: true },
    ])
    expect(run(state, [{ type: 'updatePlaced', uid: 's', changes: { x: 2 } }, { type: 'removePlaced', uid: 's' }])).toBe(state)
    state = run(state, [{ type: 'setItemFlags', uid: 's', locked: false }, { type: 'removePlaced', uid: 's' }])
    expect(state.present.items).toEqual([])
  })
})
