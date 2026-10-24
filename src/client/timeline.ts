/** Piecewise wall-clock axis and non-overlapping parent activity segments. */
import type { TraceModel, TraceSpan } from './model.ts'

export interface AxisInterval { start: number; end: number; from: number; to: number; gap: boolean }
export interface TimeAxis {
  start: number; end: number; length: number; intervals: AxisInterval[]
  project: (time: number) => number
  unproject: (position: number) => number
}
export interface TimeWindow { from: number; to: number }
export type ActivityKind = 'llm' | 'tool' | 'waiting' | 'nested' | 'error' | 'input'
export interface ActivitySegment { start: number; end: number; kind: ActivityKind }

/** Compress only intervals without recorded leaf activity; active long calls retain their duration. */
export function createTimeAxis(model: TraceModel, now = model.end, idleThreshold = 60_000): TimeAxis {
  const end = Math.max(model.start + 1, model.end, model.running ? now : model.end)
  const occupied = model.spans.filter(span => span.kind !== 'turn').map(span => ({
    start: span.start ?? span.anchor, end: span.end ?? now,
  })).sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = []
  for (const span of occupied) {
    const previous = merged.at(-1)
    if (previous && span.start <= previous.end) previous.end = Math.max(previous.end, span.end)
    else merged.push({ ...span })
  }
  const activeLength = merged.reduce((sum, span) => sum + Math.max(0, span.end - span.start), 0)
  const gapWidth = Math.max(1000, Math.min(15_000, activeLength / 50))
  const intervals: AxisInterval[] = []
  let cursor = model.start, position = 0
  const append = (start: number, finish: number, gap: boolean) => {
    if (finish <= start) return
    const width = gap ? gapWidth : finish - start
    intervals.push({ start, end: finish, from: position, to: position + width, gap })
    position += width
  }
  for (const span of merged) {
    append(cursor, span.start, span.start - cursor > idleThreshold)
    append(Math.max(cursor, span.start), span.end, false)
    cursor = Math.max(cursor, span.end)
  }
  append(cursor, end, end - cursor > idleThreshold)
  const interpolate = (value: number, reverse: boolean) => {
    const piece = intervals.find(part => value <= (reverse ? part.to : part.end)) ?? intervals.at(-1)
    if (!piece) return reverse ? model.start : 0
    const [a, b, c, d] = reverse ? [piece.from, piece.to, piece.start, piece.end] : [piece.start, piece.end, piece.from, piece.to]
    return c + (Math.min(b, Math.max(a, value)) - a) / (b - a) * (d - c)
  }
  return { start: model.start, end, length: Math.max(1, position), intervals,
    project: time => interpolate(time, false), unproject: value => interpolate(value, true) }
}

export function clampWindow(window: TimeWindow, length: number): TimeWindow {
  const width = Math.min(length, Math.max(Math.min(1, length), window.to - window.from))
  const from = Math.min(Math.max(0, window.from), length - width)
  return { from, to: from + width }
}

/** Zoom around the selected instant or the visible center, preserving its relative position. */
export function zoomWindow(window: TimeWindow, factor: number, length: number, anchor = (window.from + window.to) / 2): TimeWindow {
  const ratio = Math.min(1, Math.max(0, (anchor - window.from) / (window.to - window.from)))
  const width = (window.to - window.from) / factor
  return clampWindow({ from: anchor - width * ratio, to: anchor + width * (1 - ratio) }, length)
}

export function focusSpan(axis: TimeAxis, span: TraceSpan, now: number): TimeWindow {
  const from = axis.project(span.start ?? span.anchor), to = axis.project(span.end ?? now)
  return clampWindow({ from, to: Math.max(from + 1, to) }, axis.length)
}

/** Label only the visible portion of an idle break; a focused turn can overlap a few boundary milliseconds. */
export function visibleGaps(axis: TimeAxis, window: TimeWindow): AxisInterval[] {
  return axis.intervals.filter(part => part.gap && part.to > window.from && part.from < window.to).map(part => {
    const from = Math.max(part.from, window.from), to = Math.min(part.to, window.to)
    return { ...part, from, to, start: axis.unproject(from), end: axis.unproject(to) }
  }).filter(part => part.end - part.start > 60_000)
}

export function activityKind(span: TraceSpan): ActivityKind {
  if (span.status === 'error') return 'error'
  if (span.nested) return 'nested'
  if (span.kind === 'llm' || span.kind === 'compaction') return 'llm'
  if (span.kind === 'tool') return 'tool'
  return 'input'
}

/** Split model prefill from decoding; never infer a first-token timestamp. */
export function leafSegments(span: TraceSpan, now: number): ActivitySegment[] {
  const start = span.start ?? span.anchor, end = span.end ?? now
  const kind = activityKind(span)
  if (span.kind === 'llm' && span.firstToken !== undefined && span.firstToken > start && span.firstToken < end && span.status !== 'error') {
    return [{ start, end: span.firstToken, kind: 'waiting' }, { start: span.firstToken, end, kind }]
  }
  return [{ start, end, kind }]
}

/** Sweep child intervals once; overlap priority is failure, handoff, model, then tools. */
export function compositeSegments(parent: TraceSpan, children: readonly TraceSpan[], now: number): ActivitySegment[] {
  const start = parent.start ?? parent.anchor, end = parent.end ?? now
  const activity = children.flatMap(child => leafSegments(child, now)).filter(part => part.end > part.start && part.kind !== 'input')
  const points = [...new Set([start, end, ...activity.flatMap(part => [Math.max(start, part.start), Math.min(end, part.end)])])].filter(time => time >= start && time <= end).sort((a, b) => a - b)
  const priority: Record<ActivityKind, number> = { error: 5, nested: 4, llm: 3, tool: 2, waiting: 1, input: 0 }
  const result: ActivitySegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!
    const active = activity.filter(part => part.start < b && part.end > a).sort((left, right) => priority[right.kind] - priority[left.kind])[0]
    const kind = active?.kind ?? 'waiting'
    const previous = result.at(-1)
    if (previous?.kind === kind && previous.end === a) previous.end = b
    else result.push({ start: a, end: b, kind })
  }
  return result
}

/** Clip a real interval into the visible compressed domain. */
export function intervalPosition(axis: TimeAxis, window: TimeWindow, start: number, end: number): { left: number; width: number } | null {
  const a = axis.project(start), b = axis.project(end)
  if (b < window.from || a > window.to) return null
  const scale = 100 / (window.to - window.from)
  return { left: Math.max(0, a - window.from) * scale, width: Math.max(0, Math.min(window.to, b) - Math.max(window.from, a)) * scale }
}
