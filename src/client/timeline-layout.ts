/** Pixel layout only: recorded intervals and activity accounting are never changed. */
import { compactDuration } from './model.ts'
import { intervalPosition, type ActivityKind, type ActivitySegment, type TimeAxis, type TimeWindow } from './timeline.ts'

export interface AxisTick { left: number; label: string }

const TICK_STEPS = [
  ...[1, 2, 5, 10, 15, 20, 30].map(seconds => seconds * 1000),
  ...[1, 2, 5, 10, 15, 30].map(minutes => minutes * 60_000),
  ...[1, 2, 3, 6, 12].map(hours => hours * 3_600_000),
]

export function timelineStep(length: number, width: number): number {
  const rough = length / Math.max(1, Math.floor(width / 110))
  return TICK_STEPS.find(value => value >= rough) ?? Math.ceil(rough / 43_200_000) * 43_200_000
}

/** Use clock-friendly steps with a shared unit, then project real time through the compressed axis. */
export function timelineTicks(axis: TimeAxis, window: TimeWindow, origin: number, width: number): AxisTick[] {
  const step = timelineStep(window.to - window.from, width)
  const unit = step >= 3_600_000 ? 3_600_000 : step >= 60_000 ? 60_000 : 1000
  const suffix = unit === 1000 ? 's' : unit === 60_000 ? 'm' : 'h'
  const firstGapEnd = axis.intervals.find(part => part.gap && part.end > origin)?.end
  const offsets = new Set<number>()
  // The focused origin can precede the first event by a few milliseconds.
  const originPosition = axis.project(origin)
  if (originPosition >= window.from && originPosition <= window.to) offsets.add(0)
  const visibleStart = axis.unproject(window.from), visibleEnd = axis.unproject(window.to)
  for (const part of axis.intervals) {
    if (part.gap || part.to < window.from || part.from > window.to) continue
    const from = Math.max(part.start, visibleStart) - origin
    const to = Math.min(part.end, visibleEnd) - origin
    for (let offset = Math.ceil(from / step) * step; offset <= to; offset += step) offsets.add(offset)
  }
  let previous = -Infinity
  const labels = new Set<string>()
  return [...offsets].sort((a, b) => a - b).flatMap(offset => {
    const left = (axis.project(origin + offset) - window.from) / (window.to - window.from) * 100
    if ((left - previous) * width / 100 < 64) return []
    const hoursAfterGap = offset >= 7_200_000 && firstGapEnd !== undefined && origin + offset >= firstGapEnd
    const label = offset === 0 ? '0s' : hoursAfterGap ? compactDuration(offset) : `${offset / unit}${suffix}`
    if (labels.has(label)) return []
    labels.add(label)
    previous = left
    return [{ left, label }]
  })
}

export interface PaintedSegment { left: number; width: number; kind: ActivityKind; narrow: boolean }

/** Coalesce adjacent subpixel detail into its dominant activity; keep failure and handoff markers distinct. */
export function compositeLayout(segments: readonly ActivitySegment[], axis: TimeAxis, window: TimeWindow, width: number): PaintedSegment[] {
  const result: PaintedSegment[] = []
  let pending: { left: number; end: number; weights: Map<ActivityKind, number> } | undefined
  const append = (left: number, end: number, kind: ActivityKind) => {
    const narrow = end - left < 6
    const inset = narrow ? 0 : 1
    result.push({ left: left + inset, width: Math.max(.5, end - left - inset * 2), kind, narrow })
  }
  const flush = () => {
    if (!pending) return
    const kind = [...pending.weights].sort((a, b) => b[1] - a[1])[0]![0]
    append(pending.left, pending.end, kind)
    pending = undefined
  }
  for (const segment of segments) {
    const position = intervalPosition(axis, window, segment.start, segment.end)
    if (!position || !position.width) continue
    const left = position.left * width / 100, size = position.width * width / 100, end = left + size
    if (size >= 6 || segment.kind === 'error' || segment.kind === 'nested') {
      flush(); append(left, end, segment.kind)
    } else {
      if (pending && left - pending.end > 2) flush()
      pending ??= { left, end, weights: new Map() }
      pending.end = end
      pending.weights.set(segment.kind, (pending.weights.get(segment.kind) ?? 0) + size)
    }
  }
  flush()
  return result
}
