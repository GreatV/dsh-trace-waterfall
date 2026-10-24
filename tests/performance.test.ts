import { describe, expect, it, vi } from 'vitest'
import { buildTrace, payloadText, spanLabel, visibleRows, type TraceModel, type TraceSpan } from '../src/client/model.ts'
import { compositeSegments, createSegmentCache, createTimeAxis, leafSegments, type ActivityKind, type ActivitySegment } from '../src/client/timeline.ts'
import { overviewPath, overviewRuns } from '../src/client/overview.ts'
import type { TrajectorySnapshot } from '../src/client/adapter/trajectory-contract.ts'
import { BASE, fixture, t, tool } from './fixture.ts'

function modelFor(spans: TraceSpan[]): TraceModel {
  return { spans, byId: new Map(spans.map(span => [span.id, span])), children: new Map(), roots: spans,
    start: Math.min(...spans.map(span => span.start ?? span.anchor)), end: Math.max(...spans.map(span => span.end ?? span.anchor)),
    running: spans.some(span => span.status === 'running'), metrics: { llm: 0, tools: 0, errors: 0, tokens: null, cacheRate: null } }
}

/** Independent reference: the original interval-by-interval priority definition. */
function referenceSegments(parent: TraceSpan, children: TraceSpan[], now: number): ActivitySegment[] {
  const start = parent.start ?? parent.anchor, end = parent.end ?? now
  const activity = children.flatMap(child => leafSegments(child, now)).filter(part => part.end > part.start && part.kind !== 'input')
  const points = [...new Set([start, end, ...activity.flatMap(part => [Math.max(start, part.start), Math.min(end, part.end)])])]
    .filter(time => time >= start && time <= end).sort((a, b) => a - b)
  const priority: Record<ActivityKind, number> = { error: 5, nested: 4, llm: 3, tool: 2, waiting: 1, input: 0 }
  const result: ActivitySegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!
    const active = activity.filter(part => part.start < b && part.end > a).sort((left, right) => priority[right.kind] - priority[left.kind])[0]
    const kind = active?.kind ?? 'waiting', previous = result.at(-1)
    if (previous?.kind === kind && previous.end === a) previous.end = b
    else result.push({ start: a, end: b, kind })
  }
  return result
}

describe('performance changes preserve recorded results', () => {
  it('input cursors match the original attribution across retries, out-of-order timestamps and cropped history', () => {
    const source = fixture(), assistant = source.eventNodes.find(node => node.kind === 'assistant')!
    if (assistant.kind !== 'assistant') throw new Error('Assistant required')
    const events: TrajectorySnapshot['eventNodes'][number][] = [], requests: TrajectorySnapshot['requests'][number][] = []
    for (let step = 1; step <= 50; step++) {
      const seq = step * 10
      requests.push({ ...source.requests[0]!, purpose: 'assistant', turn: 1, step, startSeq: seq,
        startedAt: BASE + seq, completedAt: step % 7 ? BASE + seq + 5 : null,
        ...(step % 3 ? { resultSeq: seq + 5 } : {}) })
      events.push({ ...source.eventNodes[0]!, seq: seq + 1, time: BASE + seq + (step % 4 ? 1 : 20) },
        { ...tool(`call-${step}`, 'bash', seq + 2, seq + 3), seq: seq + 3 })
      if (step % 3) events.push({ ...assistant, seq: seq + 5, step, time: BASE + seq + 5 })
      if (step % 6 === 0) requests.push({ ...requests.at(-1)!, startSeq: seq + 6 })
    }
    for (const crop of [0, 63, 204]) {
      const snapshot = { ...source, requests: requests.filter(request => request.startSeq >= crop).reverse(),
        eventNodes: events.filter(event => event.seq >= crop).reverse() }
      const assistants = new Map(snapshot.eventNodes.filter(node => node.kind === 'assistant').map(node => [`${node.turn}:${node.step}`, node]))
      const inputs = snapshot.eventNodes.filter(node => node.kind === 'user' || node.kind === 'steering' || node.kind === 'context' || node.kind === 'tool-result')
        .sort((a, b) => a.seq - b.seq)
      const sorted = snapshot.requests.filter(request => request.purpose === 'assistant').sort((a, b) => a.startSeq - b.startSeq)
      const model = buildTrace(snapshot)
      let consumed = -Infinity
      for (const [index, request] of sorted.entries()) {
        const result = assistants.get(`${request.turn}:${request.step}`)
        const upper = request.resultSeq ?? result?.seq ?? sorted[index + 1]?.startSeq ?? Infinity
        for (const previous of assistants.values()) if (previous.seq < request.startSeq) consumed = Math.max(consumed, previous.seq)
        const added = inputs.filter(input => input.seq > consumed && input.seq < upper && (request.completedAt === null || input.time <= request.completedAt))
        expect(model.byId.get(`request:${request.startSeq}`)?.newInput).toEqual(added.map(node => ({
          kind: node.kind === 'tool-result' ? 'tool' : node.kind === 'context' ? 'context' : 'message',
          ...(node.kind === 'tool-result' ? { name: node.name } : {}), content: node.content,
        })))
        consumed = Math.max(consumed, request.resultSeq ?? result?.seq ?? request.startSeq, added.at(-1)?.seq ?? -Infinity)
      }
      expect(buildTrace({ ...snapshot, partial: null }).spans).toEqual(model.spans)
    }
  })

  it('linear turn grouping retains the first input and last output on equal timestamps', () => {
    const source = fixture(), location = source.eventLocations.get(1)!, user = source.eventNodes[0]!
    const assistant = source.eventNodes.find(node => node.kind === 'assistant')!
    if (assistant.kind !== 'assistant') throw new Error('Assistant required')
    const events = [{ ...user, seq: 9 }, { ...user, seq: 3, content: [{ type: 'text' as const, text: 'Later tied input' }] },
      { ...assistant, seq: 5, step: 1 }, { ...assistant, seq: 4, step: 2, blocks: [{ kind: 'text' as const, text: 'Last tied output' }] }]
    const model = buildTrace({ ...source, requests: [], eventNodes: events, eventLocations: new Map(events.map(event => [event.seq, location])) })
    expect(model.byId.get('turn:1')?.input).toEqual(user.kind === 'user' ? user.content : undefined)
    expect(model.byId.get('turn:1')?.output).toEqual([{ kind: 'text', text: 'Last tied output' }])
  })

  it('binary projection is exactly equal to linear lookup at boundaries, gaps, clamped values and NaN', () => {
    const source = fixture()
    const model = buildTrace({ ...source, requests: [], eventLocations: new Map(), eventNodes:
      Array.from({ length: 150 }, (_, i) => tool(`span-${i}`, 'bash', i * 91_000, i * 91_000 + 731.25)) })
    const axis = createTimeAxis(model)
    for (const reverse of [false, true]) {
      const linear = (value: number) => {
        const piece = axis.intervals.find(part => value <= (reverse ? part.to : part.end)) ?? axis.intervals.at(-1)!
        const [a, b, c, d] = reverse ? [piece.from, piece.to, piece.start, piece.end] : [piece.start, piece.end, piece.from, piece.to]
        return c! + (Math.min(b!, Math.max(a!, value)) - a!) / (b! - a!) * (d! - c!)
      }
      const samples = [NaN, Infinity, -Infinity, ...axis.intervals.flatMap(part => {
        const a = reverse ? part.from : part.start, b = reverse ? part.to : part.end
        return [a, b, a - .5, b + .5, (a + b) / 2]
      })]
      for (const value of samples) expect(reverse ? axis.unproject(value) : axis.project(value)).toBe(linear(value))
    }
  })

  it('endpoint sweep matches the reference for overlapping, clipped, missing-start and live spans', () => {
    let seed = 73
    const random = (limit: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit }
    for (let example = 0; example < 250; example++) {
      const parent: TraceSpan = { id: 'parent', kind: 'turn', start: 10, end: example % 5 ? 100 : null, anchor: 10, status: 'complete' }
      const children: TraceSpan[] = Array.from({ length: 30 }, (_, i) => {
        const start = random(150) - 20, end = start + random(90)
        return { id: String(i), kind: ['tool', 'llm', 'message', 'compaction'][random(4)] as TraceSpan['kind'],
          start: i % 8 ? start : null, end: i % 7 ? end : null, anchor: start, firstToken: start + random(30),
          status: i % 9 ? 'complete' : 'error', nested: i % 6 === 0 }
      })
      expect(compositeSegments(parent, children, 120)).toEqual(referenceSegments(parent, children, 120))
    }
  })

  it('computes branches on demand and keeps completed segments stable while live segments advance', () => {
    const source = fixture(), model = buildTrace(source)
    const reads = vi.spyOn(model.children, 'get')
    const segmentsFor = createSegmentCache(model)
    expect(reads).not.toHaveBeenCalled()
    const root = model.byId.get('turn:1')!, first = segmentsFor(root, BASE + 5000)
    expect(first).toEqual(referenceSegments(root, model.spans.filter(span => span.kind !== 'turn'), BASE + 5000))
    const count = reads.mock.calls.length
    expect(segmentsFor(root, BASE + 5100)).toBe(first)
    expect(reads).toHaveBeenCalledTimes(count)
    reads.mockRestore()
    const live: TraceSpan = { id: 'live', kind: 'tool', start: 0, end: null, anchor: 0, status: 'running' }
    const running = createSegmentCache(modelFor([live]))
    expect(running(live, 10)).toEqual([{ start: 0, end: 10, kind: 'tool' }])
    expect(running(live, 20)).toEqual([{ start: 0, end: 20, kind: 'tool' }])
  })

  it('cached search agrees with joined text, including field boundaries, locale and exact identifiers', () => {
    const original = buildTrace(fixture())
    const spans = original.spans.map(span => ({ ...span, parentId: undefined }))
    const model = modelFor(spans)
    const queries = ['s', 'st', 'stat', 'stat_file', 'deepseek-chat deepseek', 'permission', 'src/index.ts', 'tool:r', 'tool:read', 'request:', 'turn 1', 'model request', '工具', 'not present']
    const chinese = ((key: string) => key === 'tool' ? '工具' : key === 'llm' ? '模型请求' : key) as typeof t
    for (const translate of [t, chinese]) for (const query of queries) {
      const expected = spans.filter(span => [spanLabel(span, translate), span.model, span.provider, span.error,
        payloadText(span.newInput), payloadText(span.input), payloadText(span.output)].join(' ').toLocaleLowerCase().includes(query)
        || span.id.toLocaleLowerCase() === query).map(span => span.id)
      expect(visibleRows(model, new Set(), query, false, translate).map(row => row.span.id)).toEqual(expected)
    }
    const toJSON = vi.fn(() => ({ text: 'needle in payload' }))
    const custom = modelFor([{ id: 'custom', kind: 'tool', start: 0, end: 1, anchor: 0, status: 'complete', input: { toJSON } }])
    for (const query of ['needle', 'payload', 'absent', 'needle']) visibleRows(custom, new Set(), query, false, t)
    expect(toJSON).toHaveBeenCalledOnce()
    const changed = modelFor([{ ...custom.spans[0]!, input: 'replacement' }])
    expect(visibleRows(changed, new Set(), 'needle', false, t)).toHaveLength(0)
    expect(visibleRows(changed, new Set(), 'replacement', false, t)).toHaveLength(1)
  })

  it('overview batching preserves every span and overlap paint order, and separates live shapes', () => {
    const spans: TraceSpan[] = Array.from({ length: 6 }, (_, i) => ({ id: String(i), kind: 'tool', start: 0, end: 100,
      anchor: 0, status: i === 2 ? 'error' : 'complete' }))
    spans[5] = { ...spans[5]!, end: null, status: 'running' }
    const model = modelFor(spans), axis = createTimeAxis(model, 200), runs = overviewRuns(model)
    expect(runs.map(run => [run.kind, run.running, run.spans.map(span => span.id)]))
      .toEqual([['tool', false, ['0', '1']], ['error', false, ['2']], ['tool', false, ['3', '4']], ['tool', true, ['5']]])
    expect(overviewPath(runs[0]!, axis, 200).match(/M/g)).toHaveLength(2)
    expect(overviewPath(runs[0]!, axis, 150)).toBe(overviewPath(runs[0]!, axis, 200))
    expect(overviewPath(runs[3]!, axis, 150)).not.toBe(overviewPath(runs[3]!, axis, 200))
  })
})
