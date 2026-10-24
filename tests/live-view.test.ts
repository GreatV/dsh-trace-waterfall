import { describe, expect, it } from 'vitest'
import { followsTail, mayFollowTail, nextLiveAxisEnd } from '../src/client/live-view.ts'

describe('live-view rules', () => {
  it('follows within two pixels of the bottom, stops on upward scroll, and resumes at the bottom', () => {
    expect(followsTail(878, 800, 1000, 120, true)).toBe(true)
    expect(followsTail(877, 800, 1000, 120, true)).toBe(false)
    expect(followsTail(879, 880, 1000, 120, true)).toBe(false)
    expect(followsTail(880, 100, 1000, 120, true)).toBe(true)
    expect(followsTail(880, 100, 1000, 120, false)).toBe(false)
  })
  it('blocks following while searching, filtering errors, focusing or inspecting', () => {
    expect(mayFollowTail('', false, false, false)).toBe(true)
    expect(mayFollowTail('needle', false, false, false)).toBe(false)
    expect(mayFollowTail('', true, false, false)).toBe(false)
    expect(mayFollowTail('', false, true, false)).toBe(false)
    expect(mayFollowTail('', false, false, true)).toBe(false)
  })
  it('reserves a rounded block and keeps its end exactly fixed until the clock crosses it', () => {
    const first = nextLiveAxisEnd(undefined, 60_000, 60_000, 620)
    expect(first).toBe(75_000)
    for (const end of [60_100, 65_000, 74_999, 75_000]) expect(nextLiveAxisEnd(first, end, end, 620)).toBe(first)
    const expanded = nextLiveAxisEnd(first, 75_100, 75_100, 620)
    expect(expanded).toBe(100_000)
    expect(nextLiveAxisEnd(expanded, 75_200, 75_200, 620)).toBe(expanded)
  })
  it('sizes spare time by the compressed visible duration rather than the hours of idle time', () => {
    const end = 8 * 3_600_000
    expect(nextLiveAxisEnd(undefined, end, 60_000, 620)).toBe(end + 15_000)
  })
})
