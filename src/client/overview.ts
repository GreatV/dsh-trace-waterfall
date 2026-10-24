/** Batch overview shapes without changing per-lane paint order, colors or rounded corners. */
import type { TraceModel, TraceSpan } from './model.ts'
import { activityKind, type ActivityKind, type TimeAxis } from './timeline.ts'

export interface OverviewRun { lane: number; kind: ActivityKind; running: boolean; spans: TraceSpan[] }

export function overviewRuns(model: TraceModel): OverviewRun[] {
  const lanes: OverviewRun[][] = [[], [], []]
  for (const span of model.spans) {
    if (span.kind === 'turn') continue
    const lane = span.kind === 'llm' || span.kind === 'compaction' ? 1 : span.kind === 'tool' ? 2 : 0
    const kind = activityKind(span), running = span.end === null
    let run = lanes[lane]!.at(-1)
    if (!run || run.kind !== kind || run.running !== running) {
      run = { lane, kind, running, spans: [] }
      lanes[lane]!.push(run)
    }
    run.spans.push(span)
  }
  return lanes.flat()
}

export function overviewPath(run: OverviewRun, axis: TimeAxis, now: number): string {
  return run.spans.map(span => {
    const x = axis.project(span.start ?? span.anchor) / axis.length * 1000
    const end = axis.project(span.end ?? now) / axis.length * 1000
    const width = Math.max(1.2, end - x), rx = Math.min(1.5, width / 2), y = run.lane * 12 + 3
    return `M${x + rx} ${y}h${width - rx * 2}a${rx} 1.5 0 0 1 ${rx} 1.5v3a${rx} 1.5 0 0 1 ${-rx} 1.5h${-width + rx * 2}a${rx} 1.5 0 0 1 ${-rx} -1.5v-3a${rx} 1.5 0 0 1 ${rx} -1.5Z`
  }).join('')
}
