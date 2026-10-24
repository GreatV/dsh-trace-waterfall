import { describe, expect, it } from 'vitest'
import type { SessionSeq } from '@deepseek-ai/dsh-session/types'
import { buildTrace, compactDuration, visibleRows, totalTokens, cacheRate, throughput } from '../src/client/model.ts'
import { BASE, fixture, t, tool } from './fixture.ts'

describe('DSH trace conversion', () => {
  it('keeps concurrent tools on one clock and counts token categories only once', () => {
    const model = buildTrace(fixture())
    expect(model.end - model.start).toBe(3500)
    expect(model.metrics).toEqual({ llm: 1, tools: 3, errors: 1, tokens: 2000, cacheRate: 800 / 1800 })
    expect(model.byId.get('tool:search')?.start).toBe(BASE + 2100)
    expect(model.byId.get('tool:nested')?.parentId).toBe('tool:read')
    expect(model.byId.get('tool:read')?.parentId).toBe('turn:1')
    expect(model.spans.filter(span => span.kind === 'llm')).toHaveLength(1)
  })
  it('keeps unknown starts unknown when a call begins outside loaded history', () => {
    const source = fixture()
    const model = buildTrace({ ...source, eventNodes: [tool('orphan', 'read_file', null, 5000)], requests: [] })
    expect(model.byId.get('tool:orphan')?.start).toBeNull()
    expect(compactDuration(null)).toBe('—')
    expect(model.metrics.tokens).toBeNull()
    expect(model.start).toBe(BASE + 5000)
  })
  it('keeps matching descendants reachable through collapsed parents', () => {
    const model = buildTrace(fixture())
    const rows = visibleRows(model, new Set(['turn:1', 'tool:read']), 'stat_file', false, t)
    expect(rows.map(row => row.span.id)).toEqual(['turn:1', 'tool:read', 'tool:nested'])
    expect(rows.map(row => row.depth)).toEqual([0, 1, 2])
    expect(visibleRows(model, new Set(), '', true, t).map(row => row.span.id)).toEqual(['turn:1', 'tool:search'])
  })
  it('uses a stable call identity while it runs and after settlement', () => {
    const source = fixture()
    const running = { phase: 'start' as const, callId: 'live', name: 'bash', time: BASE + 4000,
      turn: 2, step: 1, argsRaw: '{}', args: tool('x', 'x', 0, 0).args, subCalls: [] }
    const live = buildTrace({ ...source, runningCalls: [running] })
    const done = buildTrace({ ...source, eventNodes: [...source.eventNodes, tool('live', 'bash', 4000, 4500)] })
    expect(live.byId.get('tool:live')?.status).toBe('running')
    expect(done.byId.get('tool:live')?.status).toBe('complete')
    expect(done.running).toBe(false)
  })
  it('retains recovered retry details without counting them as final errors', () => {
    const source = fixture()
    const request = source.requests[0]!
    const model = buildTrace({ ...source, requests: [{ ...request, purpose: 'assistant', turn: 1, step: 1, retry: 1, error: 'Transient failure' }] })
    expect(model.byId.get('request:2')?.retries).toBe(1)
    expect(model.metrics.errors).toBe(1)
  })
  it('adds all disjoint DSH billing buckets and does not add reasoning twice', () => {
    const usage = { inputTokens: 462, outputTokens: 720, cacheReadTokens: 272128, cacheWriteTokens: 100, reasoningTokens: 500 }
    expect(totalTokens(usage)).toBe(273410)
    expect(cacheRate(usage)).toBeCloseTo(272128 / 272690)
    expect(totalTokens({ cacheReadTokens: 4 })).toBe(4)
    expect(totalTokens(undefined)).toBeNull()
    expect(cacheRate({ outputTokens: 4 })).toBeNull()
  })
  it('keeps a recovered turn complete, retains its error count, and respects a failed turn end', () => {
    const source = fixture(), location = source.eventLocations.get(1)!
    if (location.kind !== 'step') throw new Error('Fixture requires a step location')
    const completed = { ...location, turn: { ...location.turn,
      end: { type: 'turn/end' as const, seq: 9000 as SessionSeq, time: BASE + 9000, data: { turn: 1, reason: { kind: 'completed' as const } } } } }
    const events = new Map(source.eventLocations); events.set(1, completed)
    const root = buildTrace({ ...source, eventLocations: events }).byId.get('turn:1')!
    expect(root).toMatchObject({ status: 'complete', errorCount: 1, end: BASE + 9000 })
    expect(totalTokens(root.usage)).toBe(2000)
    events.set(1, { ...completed, turn: { ...completed.turn,
      end: { ...completed.turn.end, data: { turn: 1, reason: { kind: 'error', error: { message: 'Model unavailable', code: 'UNKNOWN' } } } } } })
    expect(buildTrace({ ...source, eventLocations: events }).byId.get('turn:1')?.status).toBe('error')
  })
  it('computes throughput over recorded decoding time only', () => {
    const span = buildTrace(fixture()).byId.get('request:2')!
    expect(throughput(span)).toBe(125)
    expect(throughput({ ...span, firstToken: undefined })).toBeNull()
    expect(throughput({ ...span, end: span.firstToken! })).toBeNull()
  })
  it('assigns newly introduced inputs across request preparation, tool execution, and cropped history', () => {
    const source = fixture(), first = source.eventNodes.find(node => node.kind === 'assistant')!
    if (first.kind !== 'assistant') throw new Error('Assistant fixture required')
    const user = source.eventNodes[0]!
    const context = { kind: 'context' as const, seq: 4, time: BASE + 40, content: [{ type: 'text' as const, text: 'Fresh context' }], source: null,
      producer: { role: 'inject' as const, label: 'runtime' }, form: null }
    const priorTool = { ...tool('previous', 'read_file', 60, 80), seq: 6 }
    const ownTool = { ...tool('current', 'bash', 220, 250), seq: 10 }
    const requests = [
      { ...source.requests[0]!, purpose: 'assistant' as const, turn: 1, step: 1, startSeq: 2, startedAt: BASE + 20, completedAt: BASE + 50 },
      { ...source.requests[0]!, purpose: 'assistant' as const, turn: 1, step: 2, startSeq: 7, startedAt: BASE + 100, completedAt: BASE + 200 },
      { ...source.requests[0]!, purpose: 'assistant' as const, turn: 1, step: 3, startSeq: 11, startedAt: BASE + 300, completedAt: BASE + 330, status: 'error' as const },
      { ...source.requests[0]!, purpose: 'assistant' as const, turn: 2, step: 1, startSeq: 13, startedAt: BASE + 350, completedAt: null, status: 'running' as const },
    ]
    const snapshot = { ...source, requests, eventNodes: [
      { ...user, seq: 3, time: BASE + 30 }, context, { ...first, seq: 5, time: BASE + 50 }, priorTool,
      { ...context, seq: 8, time: BASE + 110 }, { ...first, seq: 9, step: 2, time: BASE + 200 }, ownTool,
      { ...user, seq: 14, time: BASE + 360 },
    ] }
    const model = buildTrace(snapshot)
    expect(model.byId.get('request:2')?.newInput?.map(input => input.kind)).toEqual(['message', 'context'])
    expect(model.byId.get('request:7')?.newInput?.map(input => input.name ?? input.kind)).toEqual(['read_file', 'context'])
    expect(model.byId.get('request:11')?.newInput?.map(input => input.name)).toEqual(['bash'])
    expect(model.byId.get('request:13')?.newInput?.map(input => input.kind)).toEqual(['message'])
    const cropped = buildTrace({ ...snapshot, requests: requests.slice(1), eventNodes: snapshot.eventNodes.filter(node => node.seq >= 6) })
    expect(cropped.byId.get('request:7')?.newInput).toEqual(model.byId.get('request:7')?.newInput)
  })
  it('uses the same short units for durations and signed offsets, including unavailable starts', () => {
    expect([0, 882, 38500, 90200, 120000, 8.5 * 3600000].map(value => compactDuration(value)))
      .toEqual(['0ms', '882ms', '38.5s', '90.2s', '2m', '8.5h'])
    expect(compactDuration(8.5 * 3600000, true)).toBe('+8.5h')
    expect(compactDuration(-38500, true)).toBe('-38.5s')
    expect(compactDuration(null, true)).toBe('—')
    expect(compactDuration(NaN)).toBe('—')
  })
})
