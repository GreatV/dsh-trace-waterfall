/** Pure rules shared by live-view effects and deterministic interaction tests. */
import { timelineStep } from './timeline-layout.ts'

export const BOTTOM_FOLLOW_THRESHOLD_PX = 2

export function mayFollowTail(query: string, errorsOnly: boolean, focused: boolean, inspecting: boolean): boolean {
  return !query.trim() && !errorsOnly && !focused && !inspecting
}

export function followsTail(scrollTop: number, previousTop: number, scrollHeight: number, clientHeight: number, allowed: boolean): boolean {
  return allowed && scrollTop >= previousTop && scrollHeight - clientHeight - scrollTop <= BOTTOM_FOLLOW_THRESHOLD_PX
}

/** Keep the deadline until crossed; add ~20% of the visible duration, rounded to a tick. */
export function nextLiveAxisEnd(previous: number | undefined, end: number, length: number, width: number): number {
  if (previous !== undefined && end <= previous) return previous
  const step = timelineStep(length, width)
  return end + Math.ceil(Math.max(1, length) * 1.2 / step) * step - length
}
