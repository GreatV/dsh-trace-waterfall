import { describe, expect, it } from 'vitest'
import { buildTrace, type TraceSpan } from '../src/client/model.ts'
import { createTimeAxis, compositeSegments, leafSegments, zoomWindow, focusSpan, intervalPosition, visibleGaps } from '../src/client/timeline.ts'
import { BASE, fixture, tool } from './fixture.ts'

describe('compressed wall-clock axis', () => {
  it('compresses hours of idle time while preserving both calls and real-time inversion', () => {
    const model = buildTrace({ ...fixture(), requests: [], eventLocations: new Map(), eventNodes: [tool('a', 'bash', 0, 1000), tool('b', 'bash', 18_000_000, 18_002_000)] })
    const axis = createTimeAxis(model)
    expect(axis.intervals.filter(part => part.gap)).toHaveLength(1)
    expect(axis.length).toBe(4000)
    expect(axis.project(BASE + 1000) - axis.project(BASE)).toBe(1000)
    expect(axis.project(BASE + 18_002_000) - axis.project(BASE + 18_000_000)).toBe(2000)
    expect(visibleGaps(axis, { from: axis.project(BASE + 17_999_990), to: axis.length })).toEqual([])
    expect(visibleGaps(axis, { from: 0, to: axis.length })[0]?.end).toBe(BASE + 18_000_000)
    for (const offset of [0, 500, 1000, 9_000_000, 18_000_000, 18_001_000, 18_002_000]) {
      expect(axis.unproject(axis.project(BASE + offset))).toBeCloseTo(BASE + offset, 3)
    }
  })
  it('does not compress active long calls or overlap and leaves short idle intervals intact', () => {
    const model = buildTrace({ ...fixture(), requests: [], eventLocations: new Map(), eventNodes: [tool('a', 'bash', 0, 300_000), tool('b', 'bash', 200_000, 350_000), tool('c', 'bash', 380_000, 390_000)] })
    const axis = createTimeAxis(model)
    expect(axis.intervals.some(part => part.gap)).toBe(false)
    expect(axis.length).toBe(390_000)
  })
  it('focuses a span and zooms around a selected instant or viewport center', () => {
    const model = buildTrace(fixture()), axis = createTimeAxis(model)
    const window = focusSpan(axis, model.byId.get('tool:read')!, model.end)
    expect(window.from).toBe(axis.project(BASE + 2000))
    expect(window.to).toBeGreaterThanOrEqual(axis.project(BASE + 3500))
    expect(zoomWindow({ from: 100, to: 500 }, 2, 1000)).toEqual({ from: 200, to: 400 })
    expect(zoomWindow({ from: 100, to: 500 }, 2, 1000, 200)).toEqual({ from: 150, to: 350 })
    expect(zoomWindow({ from: 0, to: 300 }, .5, 500)).toEqual({ from: 0, to: 500 })
    expect(intervalPosition(axis, { from: 100, to: 500 }, BASE + 600, BASE + 1000)).toBeNull()
  })
})

describe('parent activity segments', () => {
  const parent: TraceSpan = { id: 'turn:1', kind: 'turn', start: 0, end: 100, anchor: 0, status: 'complete' }
  it('fills idle with hatch and splits prefill from decoding without double-painting overlaps', () => {
    const llm: TraceSpan = { ...parent, id: 'model', kind: 'llm', start: 10, end: 40, firstToken: 20 }
    const tool: TraceSpan = { ...parent, id: 'tool', kind: 'tool', start: 30, end: 70 }
    expect(compositeSegments(parent, [llm, tool], 100)).toEqual([
      { start: 0, end: 20, kind: 'waiting' }, { start: 20, end: 40, kind: 'llm' },
      { start: 40, end: 70, kind: 'tool' }, { start: 70, end: 100, kind: 'waiting' },
    ])
    expect(leafSegments(llm, 100)).toHaveLength(2)
    expect(leafSegments({ ...llm, firstToken: undefined }, 100)).toHaveLength(1)
  })
  it('marks only the failing interval and uses green for nested handoffs', () => {
    const call: TraceSpan = { ...parent, id: 'tool', kind: 'tool', start: 5, end: 90 }
    const nested: TraceSpan = { ...call, id: 'nested', start: 20, end: 60, nested: true }
    const error: TraceSpan = { ...nested, id: 'error', start: 30, end: 35, status: 'error' }
    const result = compositeSegments(parent, [call, nested, error], 100)
    expect(result.filter(part => part.kind === 'error')).toEqual([{ start: 30, end: 35, kind: 'error' }])
    expect(result.filter(part => part.kind === 'nested')).toEqual([{ start: 20, end: 30, kind: 'nested' }, { start: 35, end: 60, kind: 'nested' }])
    expect(result.reduce((sum, part) => sum + part.end - part.start, 0)).toBe(100)
    expect(compositeSegments(parent, [], 100)).toEqual([{ start: 0, end: 100, kind: 'waiting' }])
  })
})
