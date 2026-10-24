import { describe, expect, it } from 'vitest'
import { buildTrace } from '../src/client/model.ts'
import { createTimeAxis, type ActivitySegment } from '../src/client/timeline.ts'
import { compositeLayout, timelineTicks } from '../src/client/timeline-layout.ts'
import { BASE, fixture, tool } from './fixture.ts'

function axisFor(calls: ReturnType<typeof tool>[]) {
  return createTimeAxis(buildTrace({ ...fixture(), eventNodes: calls, requests: [], eventLocations: new Map() }))
}

describe('timeline presentation layout', () => {
  it.each([
    { duration: 90_000, labels: ['0s', '20s', '40s', '60s', '80s'] },
    { duration: 288_000, labels: ['0s', '1m', '2m', '3m', '4m'] },
    { duration: 150 * 60_000, labels: ['0s', '30m', '60m', '90m', '120m', '150m'] },
    { duration: 24 * 3_600_000, labels: ['0s', '6h', '12h', '18h', '24h'] },
  ])('uses clock-friendly steps and one unit for a $duration ms focused range', ({ duration, labels }) => {
    const start = 18_000_000
    const axis = axisFor([tool('first', 'bash', 0, 1000), tool('focused', 'bash', start, start + duration)])
    const window = { from: axis.project(BASE + start), to: axis.length }
    const ticks = timelineTicks(axis, window, BASE + start, 620)
    expect(ticks.map(tick => tick.label)).toEqual(labels)
  })
  it('uses rounded real-time ticks in a focused range, and skips compressed idle time', () => {
    const axis = axisFor([tool('first', 'bash', 0, 90_200), tool('later', 'bash', 18_000_000, 18_090_200)])
    const focused = { from: axis.project(BASE + 18_000_000), to: axis.length }
    const ticks = timelineTicks(axis, focused, BASE + 18_000_000, 620)
    expect(ticks.map(tick => tick.label)).toEqual(['0s', '20s', '40s', '60s', '80s'])
    expect(ticks[1]!.left).toBeCloseTo(20_000 / 90_200 * 100)
    const withLeadIn = { from: focused.from - .001, to: focused.to }
    expect(timelineTicks(axis, withLeadIn, axis.unproject(withLeadIn.from), 620)[0]?.label).toBe('0s')
    const full = timelineTicks(axis, { from: 0, to: axis.length }, BASE, 620)
    expect(full.map(tick => tick.label)).toContain('5h')
    expect(full.every(tick => {
      const time = axis.unproject(tick.left / 100 * axis.length)
      return time <= BASE + 90_200 || time >= BASE + 18_000_000
    })).toBe(true)
  })
  it('abbreviates offsets beyond two hours after a compressed gap while retaining minute steps', () => {
    const minute = 60_000
    const axis = axisFor([tool('first', 'bash', 0, 10 * minute), tool('later', 'bash', 455 * minute, 470 * minute)])
    const ticks = timelineTicks(axis, { from: 0, to: axis.length }, BASE, 620)
    expect(ticks.map(tick => tick.label)).toEqual(['0s', '10m', '7.7h', '7.8h'])
    expect(ticks.find(tick => tick.label === '7.7h')!.left).toBeCloseTo(axis.project(BASE + 460 * minute) / axis.length * 100)
  })
  it('coalesces narrow activity without dropping failure/handoff markers or changing source intervals', () => {
    const axis = axisFor([tool('first', 'bash', 0, 1000)])
    const segments: ActivitySegment[] = [
      { start: BASE, end: BASE + 20, kind: 'waiting' },
      { start: BASE + 20, end: BASE + 60, kind: 'llm' },
      { start: BASE + 60, end: BASE + 100, kind: 'tool' },
      { start: BASE + 100, end: BASE + 101, kind: 'error' },
      { start: BASE + 101, end: BASE + 103, kind: 'nested' },
      { start: BASE + 103, end: BASE + 1000, kind: 'tool' },
    ]
    const original = structuredClone(segments)
    const layout = compositeLayout(segments, axis, { from: 0, to: axis.length }, 100)
    expect(layout).toHaveLength(4)
    expect(layout[0]).toMatchObject({ left: 1, width: 8, kind: 'llm', narrow: false })
    expect(layout.slice(1, 3).map(part => [part.kind, part.narrow])).toEqual([['error', true], ['nested', true]])
    expect(segments).toEqual(original)
    const focused = compositeLayout(segments, axis, { from: 100, to: 500 }, 100)
    expect(focused.every(part => part.left >= 0 && part.left + part.width <= 100)).toBe(true)
  })
})
