/** Convert DSH's independently assembled trace records into a timed span tree. */
import type { AssistantMessageNode, RequestView, ToolCallBlock } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TrajectorySnapshot } from './adapter/trajectory-contract.ts'
import type { TraceTranslate } from './locales.ts'

export type SpanKind = 'turn' | 'llm' | 'tool' | 'compaction' | 'message' | 'context' | 'system'
export interface TraceUsage {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}
export interface TraceInput {
  kind: 'message' | 'context' | 'tool'
  name?: string
  content: unknown
}
export interface TraceSpan {
  id: string
  parentId?: string
  kind: SpanKind
  name?: string
  turn?: number
  step?: number
  start: number | null
  end: number | null
  /** Sorting remains meaningful when the call head is outside the history window. */
  anchor: number
  status: 'running' | 'complete' | 'error'
  input?: unknown
  /** Loaded user/context messages and tool results introduced for this generation. */
  newInput?: readonly TraceInput[]
  output?: unknown
  metadata?: unknown
  model?: string
  provider?: string
  usage?: TraceUsage
  firstToken?: number
  retries?: number
  error?: string
  errorCount?: number
  schema?: unknown
  nested?: boolean
}
export interface TraceModel {
  spans: readonly TraceSpan[]
  byId: ReadonlyMap<string, TraceSpan>
  children: ReadonlyMap<string, readonly TraceSpan[]>
  roots: readonly TraceSpan[]
  start: number
  end: number
  running: boolean
  metrics: { llm: number; tools: number; errors: number; tokens: number | null; cacheRate: number | null }
}

/** DSH usage buckets are disjoint; reasoning is already part of output. */
export function totalTokens(usage: TraceUsage | undefined): number | null {
  if (!usage || !['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'].some(key => Reflect.get(usage, key) !== undefined)) return null
  return (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) + (usage.outputTokens ?? 0)
}

export function cacheRate(usage: TraceUsage): number | null {
  const input = (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
  return input > 0 ? (usage.cacheReadTokens ?? 0) / input : null
}

function addUsage(target: TraceUsage, usage: TraceUsage | undefined): void {
  if (!usage) return
  for (const key of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens'] as const) {
    if (usage[key] !== undefined) target[key] = (target[key] ?? 0) + usage[key]
  }
}

/** Read optional provider usage without guessing absent accounting. */
function usageOf(value: unknown): TraceUsage | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const usage: TraceUsage = {}
  for (const key of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens'] as const) {
    const amount = Reflect.get(value, key)
    if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) usage[key] = amount
  }
  return Object.keys(usage).length ? usage : undefined
}

/** Request.prompt is a system/config/tool snapshot, not the conversation input. */
const inputBatches = new WeakMap<TrajectorySnapshot['eventNodes'], { requests: TrajectorySnapshot['requests']; value: ReadonlyMap<number, readonly TraceInput[]> }>()
function requestInputs(snapshot: TrajectorySnapshot, assistants: ReadonlyMap<string, AssistantMessageNode>): ReadonlyMap<number, readonly TraceInput[]> {
  const cached = inputBatches.get(snapshot.eventNodes)
  if (cached?.requests === snapshot.requests) return cached.value
  const inputs = snapshot.eventNodes.flatMap(node => {
    if (node.kind !== 'user' && node.kind !== 'steering' && node.kind !== 'context' && node.kind !== 'tool-result') return []
    const value: TraceInput = { kind: node.kind === 'tool-result' ? 'tool' : node.kind === 'context' ? 'context' : 'message',
      ...(node.kind === 'tool-result' ? { name: node.name } : {}), content: node.content }
    return [{ seq: node.seq, time: node.time, value }]
  }).sort((a, b) => a.seq - b.seq)
  const requests = snapshot.requests.filter((request): request is Extract<RequestView, { purpose: 'assistant' }> => request.purpose === 'assistant')
    .sort((a, b) => a.startSeq - b.startSeq)
  const result = new Map<number, readonly TraceInput[]>()
  const assistantSeqs = [...assistants.values()].map(node => node.seq).sort((a, b) => a - b)
  let consumed = -Infinity
  let inputIndex = 0, assistantIndex = 0
  for (const [index, request] of requests.entries()) {
    const assistant = assistants.get(`${request.turn}:${request.step}`)
    // Inputs can be logged after step/start while the request is being prepared.
    // The assistant result closes that input batch; its own tools belong to the next request.
    const upper = request.resultSeq ?? assistant?.seq ?? requests[index + 1]?.startSeq ?? Infinity
    while (assistantIndex < assistantSeqs.length && assistantSeqs[assistantIndex]! < request.startSeq) consumed = Math.max(consumed, assistantSeqs[assistantIndex++]!)
    while (inputIndex < inputs.length && inputs[inputIndex]!.seq <= consumed) inputIndex++
    const added: TraceInput[] = []
    let lastAdded = -Infinity
    for (let i = inputIndex; i < inputs.length && inputs[i]!.seq < upper; i++) {
      const input = inputs[i]!
      if (request.completedAt === null || input.time <= request.completedAt) { added.push(input.value); lastAdded = input.seq }
    }
    result.set(request.startSeq, added)
    consumed = Math.max(consumed, request.resultSeq ?? assistant?.seq ?? request.startSeq, lastAdded)
  }
  inputBatches.set(snapshot.eventNodes, { requests: snapshot.requests, value: result })
  return result
}

/** Materialize stable identities and preserve parallel calls on one time axis. */
export function buildTrace(snapshot: TrajectorySnapshot): TraceModel {
  const spans: TraceSpan[] = []
  const assistants = new Map<string, AssistantMessageNode>()
  for (const node of snapshot.eventNodes) {
    if (node.kind === 'assistant') assistants.set(`${node.turn}:${node.step}`, node)
  }
  const newInputs = requestInputs(snapshot, assistants)
  const represented = new Set<string>()
  for (const request of snapshot.requests) {
    const key = `${request.turn}:${request.step}`
    const assistant = request.purpose === 'assistant' ? assistants.get(key) : undefined
    const partial = snapshot.partial?.turn === request.turn && snapshot.partial.step === request.step
      ? snapshot.partial : undefined
    if (assistant) represented.add(key)
    spans.push({
      id: `request:${request.startSeq}`, kind: request.purpose === 'assistant' ? 'llm' : 'compaction',
      ...(request.turn === null ? {} : { parentId: `turn:${request.turn}`, turn: request.turn }),
      step: request.step, start: request.startedAt, end: request.completedAt,
      anchor: request.startedAt, status: request.status,
      model: request.providerMetadata?.model ?? request.requestConfig?.model,
      provider: request.providerMetadata?.provider ?? request.requestConfig?.provider,
      usage: usageOf(request.usage), metadata: request.requestConfig,
      input: request.purpose === 'assistant' ? request.prompt : undefined,
      newInput: request.purpose === 'assistant' ? newInputs.get(request.startSeq) : undefined,
      output: request.purpose === 'compaction' ? request.rawOutput ?? request.summary : assistant?.blocks ?? partial?.blocks,
      firstToken: assistant?.timing?.firstTokenTime ?? partial?.timing?.firstTokenTime ?? undefined,
      retries: request.purpose === 'assistant' ? request.retry : undefined,
      error: request.error || request.errorCode,
    })
  }
  function addTool(call: ToolCallBlock, parentId?: string, turn?: number) {
    const done = 'kind' in call
    const start = done ? call.callTime : call.time
    const ownerTurn = done ? turn : call.turn
    spans.push({
      id: `tool:${call.callId}`, parentId: parentId ?? (ownerTurn === undefined ? undefined : `turn:${ownerTurn}`),
      kind: 'tool', name: call.name || undefined, turn: ownerTurn,
      step: done ? undefined : call.step, start, end: done ? call.time : null,
      anchor: start ?? call.time, status: done ? call.isError ? 'error' : 'complete' : 'running',
      input: done ? call.call?.argsRaw : call.phase === 'start' ? call.argsRaw : undefined,
      output: done ? call.content : undefined, metadata: done ? call.meta : undefined,
      schema: snapshot.callSchemas.get(call.callId), nested: parentId !== undefined || call.name === 'subagent' || call.name.startsWith('subagent_') || call.name === 'spawn_teammate',
      error: done ? call.error?.reason ?? call.error?.code : undefined,
    })
    for (const child of call.subCalls) addTool(child, `tool:${call.callId}`, ownerTurn)
  }
  for (const node of snapshot.eventNodes) {
    const location = snapshot.eventLocations.get(node.seq)
    const turn = location?.kind === 'step' || location?.kind === 'turn' ? location.turn.turn : undefined
    if (node.kind === 'tool-result') { addTool(node, undefined, turn); continue }
    if (node.kind === 'assistant') {
      if (!represented.has(`${node.turn}:${node.step}`)) spans.push({
        id: `assistant:${node.seq}`, kind: 'llm', parentId: `turn:${node.turn}`, turn: node.turn, step: node.step,
        start: node.timing?.stepStartTime ?? null, end: node.time, anchor: node.time,
        status: node.interrupted ? 'error' : 'complete', output: node.blocks,
        model: node.providerMetadata?.model, provider: node.providerMetadata?.provider,
        usage: usageOf(node.usage), firstToken: node.timing?.firstTokenTime ?? undefined,
      })
      continue
    }
    if (node.kind === 'user' || node.kind === 'steering' || node.kind === 'context') {
      spans.push({
        id: `event:${node.seq}`, parentId: turn === undefined ? undefined : `turn:${turn}`, turn,
        kind: node.kind === 'context' ? 'context' : 'message',
        start: node.time, end: node.time, anchor: node.time, status: 'complete',
        input: node.content,
      })
    }
  }
  for (const call of snapshot.runningCalls) addTool(call)
  const eventIds = new Set(spans.map(span => span.id))
  for (const prompt of snapshot.systemPrompts ?? []) {
    if (eventIds.has(`event:${prompt.seq}`)) continue
    eventIds.add(`event:${prompt.seq}`)
    spans.push({
      id: `event:${prompt.seq}`, kind: 'system', start: prompt.time, end: prompt.time,
      anchor: prompt.time, status: 'complete', input: prompt.text,
    })
  }
  const metrics: TraceModel['metrics'] = { llm: 0, tools: 0, errors: 0, tokens: null, cacheRate: null }
  const usage: TraceUsage = {}
  const turns = new Map<number, TraceSpan>()
  const turnInputs = new Map<number, TraceSpan>(), turnOutputs = new Map<number, TraceSpan>()
  let start = Infinity
  let end = -Infinity
  for (const span of spans) {
    start = Math.min(start, span.start ?? span.anchor)
    end = Math.max(end, span.end ?? span.anchor)
    if (span.kind === 'llm' || span.kind === 'compaction') metrics.llm++
    if (span.kind === 'tool') metrics.tools++
    if (span.status === 'error') metrics.errors++
    addUsage(usage, span.usage)
    if (span.turn === undefined) continue
    let root = turns.get(span.turn)
    if (!root) {
      root = { id: `turn:${span.turn}`, kind: 'turn', turn: span.turn, start: span.start ?? span.anchor,
        end: span.end, anchor: span.anchor, status: span.status === 'running' ? 'running' : 'complete', usage: {}, errorCount: 0 }
      turns.set(span.turn, root)
    } else {
      root.start = Math.min(root.start ?? span.anchor, span.start ?? span.anchor)
      root.anchor = Math.min(root.anchor, span.anchor)
      root.end = root.end === null || span.end === null ? null : Math.max(root.end, span.end)
      root.status = root.status === 'running' || span.status === 'running' ? 'running' : 'complete'
    }
    addUsage(root.usage!, span.usage)
    if (span.status === 'error') root.errorCount = (root.errorCount ?? 0) + 1
    // Match stable anchor sorting: first input wins ties, last model output wins ties.
    if ((span.kind === 'message' || span.kind === 'context') && (!turnInputs.has(span.turn) || span.anchor < turnInputs.get(span.turn)!.anchor)) turnInputs.set(span.turn, span)
    if (span.kind === 'llm' && (!turnOutputs.has(span.turn) || span.anchor >= turnOutputs.get(span.turn)!.anchor)) turnOutputs.set(span.turn, span)
  }
  metrics.tokens = totalTokens(usage)
  metrics.cacheRate = cacheRate(usage)
  for (const root of turns.values()) {
    root.input = turnInputs.get(root.turn!)?.input
    root.output = turnOutputs.get(root.turn!)?.output
  }
  for (const location of snapshot.eventLocations.values()) {
    if (location.kind !== 'step' && location.kind !== 'turn') continue
    const root = turns.get(location.turn.turn)
    if (!root) continue
    if (location.turn.start) root.start = location.turn.start.time
    if (location.turn.end) {
      root.end = location.turn.end.time
      root.status = location.turn.end.data.reason.kind === 'error' ? 'error' : 'complete'
      if (location.turn.end.data.reason.kind === 'error') root.error = location.turn.end.data.reason.error.message
    }
    start = Math.min(start, root.start ?? root.anchor)
    end = Math.max(end, root.end ?? root.anchor)
  }
  spans.push(...turns.values())
  spans.sort((a, b) => a.anchor - b.anchor || a.id.localeCompare(b.id))
  const byId = new Map(spans.map(span => [span.id, span]))
  const children = new Map<string, TraceSpan[]>()
  const roots: TraceSpan[] = []
  for (const span of spans) {
    searchIndex(span)
    if (span.parentId && byId.has(span.parentId)) {
      const siblings = children.get(span.parentId) ?? []
      siblings.push(span)
      children.set(span.parentId, siblings)
    } else roots.push(span)
  }
  return { spans, byId, children, roots, start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : 0, running: spans.some(span => span.status === 'running'), metrics }
}

/** Localized label; wire model and tool names remain verbatim. */
export function spanLabel(span: TraceSpan, t: TraceTranslate): string {
  if (span.kind === 'turn') return t('turn', { number: span.turn })
  return span.name ?? t(span.kind)
}

/** JSON details are escaped by React and are never interpreted as markup. */
const payloadStrings = new WeakMap<object, string>()
export function payloadText(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2) }
    catch { return value }
  }
  if (value !== null && typeof value === 'object') {
    let text = payloadStrings.get(value)
    if (text === undefined) { text = JSON.stringify(value, null, 2) ?? ''; payloadStrings.set(value, text) }
    return text
  }
  return JSON.stringify(value, null, 2) ?? ''
}

export interface TraceRow { span: TraceSpan; depth: number; hasChildren: boolean }

// Snapshots are immutable. Weak keys release text with its records; shared prompts are
// serialized once without copying the same large string into thousands of span indexes.
const payloadSearch = new WeakMap<object, string>()
interface SearchIndex { fields: readonly string[]; id: string; label?: string; labelText?: string }
const spanSearch = new WeakMap<TraceSpan, SearchIndex>()
function searchPayload(value: unknown): string {
  if (value !== null && typeof value === 'object') {
    let text = payloadSearch.get(value)
    if (text === undefined) { text = payloadText(value).toLocaleLowerCase(); payloadSearch.set(value, text) }
    return text
  }
  return payloadText(value).toLocaleLowerCase()
}
function searchIndex(span: TraceSpan): SearchIndex {
  let index = spanSearch.get(span)
  if (!index) {
    const fields = [span.model ?? '', span.provider ?? '', span.error ?? ''].map(text => text.toLocaleLowerCase())
      .concat([searchPayload(span.newInput), searchPayload(span.input), searchPayload(span.output)])
    index = { fields, id: span.id.toLocaleLowerCase() }
    spanSearch.set(span, index)
  }
  return index
}

const modelSearch = new WeakMap<TraceModel, { term: string; locale: string; matched: readonly TraceSpan[]; ids: Map<string, TraceSpan[]> }>()
function matchingSpans(model: TraceModel, term: string, t: TraceTranslate): readonly TraceSpan[] {
  const locale = [t('turn', { number: 0 }), ...(['llm', 'tool', 'compaction', 'message', 'context', 'system'] as const).map(kind => t(kind))].join('\0')
  let cached = modelSearch.get(model)
  if (!cached) {
    const ids = new Map<string, TraceSpan[]>()
    for (const span of model.spans) {
      const id = searchIndex(span).id, values = ids.get(id) ?? []
      values.push(span); ids.set(id, values)
    }
    cached = { term: '', locale, matched: model.spans, ids }
    modelSearch.set(model, cached)
  }
  const candidates = cached.locale === locale && term.startsWith(cached.term) ? cached.matched : model.spans
  const matches = new Map<string, boolean>()
  const includes = (text: string) => {
    let match = matches.get(text)
    if (match === undefined) { match = text.includes(term); matches.set(text, match) }
    return match
  }
  const matched: TraceSpan[] = []
  for (const span of candidates) {
    const index = searchIndex(span), label = spanLabel(span, t)
    if (index.label !== label) { index.label = label; index.labelText = label.toLocaleLowerCase() }
    const fields = [index.labelText!, ...index.fields]
    let match = fields.some(includes)
    // Preserve matches crossing the spaces in the original joined text, including empty fields.
    if (!match && term.includes(' ')) {
      let tail = ''
      for (const [index, field] of fields.entries()) {
        if (index && (tail + ' ' + field.slice(0, term.length - 1)).includes(term)) { match = true; break }
        tail = (tail + (index ? ' ' : '') + field.slice(-(term.length - 1))).slice(-(term.length - 1))
      }
    }
    if (match || index.id === term) matched.push(span)
  }
  // Exact opaque IDs can become matches only on the final character; do not lose them
  // when narrowing a prefix that deliberately did not match partial identifiers.
  for (const span of cached.ids.get(term) ?? []) if (!matched.includes(span)) matched.push(span)
  cached.term = term; cached.locale = locale; cached.matched = matched
  return matched
}

/** Keep matched descendants reachable, even through collapsed ancestors. */
export function visibleRows(model: TraceModel, collapsed: ReadonlySet<string>, query: string, errorsOnly: boolean, t: TraceTranslate): TraceRow[] {
  const term = query.trim().toLocaleLowerCase()
  const filtering = term !== '' || errorsOnly
  const included = new Set<string>()
  if (filtering) for (const span of term ? matchingSpans(model, term, t) : model.spans) {
    if (errorsOnly && (span.status !== 'error' || span.kind === 'turn')) continue
    let current: TraceSpan | undefined = span
    while (current && !included.has(current.id)) {
      included.add(current.id)
      current = current.parentId ? model.byId.get(current.parentId) : undefined
    }
  }
  const rows: TraceRow[] = []
  const visit = (span: TraceSpan, depth: number) => {
    if (filtering && !included.has(span.id)) return
    const children = model.children.get(span.id) ?? []
    rows.push({ span, depth, hasChildren: children.length > 0 })
    if (filtering || !collapsed.has(span.id)) for (const child of children) visit(child, depth + 1)
  }
  for (const root of model.roots) visit(root, 0)
  return rows
}

/** One short format for metrics, bars, axes, cards, and details in either language. */
export function compactDuration(ms: number | null, offset = false): string {
  if (ms === null || !Number.isFinite(ms)) return '—'
  const value = offset ? Math.abs(ms) : Math.max(0, ms)
  const text = value < 1000 ? `${Math.round(value)}ms`
    : value < 120_000 ? `${+(value / 1000).toFixed(1)}s`
      : value < 7_200_000 ? `${+(value / 60_000).toFixed(1)}m`
        : `${+(value / 3_600_000).toFixed(1)}h`
  return offset ? `${ms < 0 ? '-' : '+'}${text}` : text
}

export function compactTokens(tokens: number | null): string {
  if (tokens === null) return '—'
  if (tokens >= 1_000_000) return `${+(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1000) return `${+(tokens / 1000).toFixed(1)}k`
  return tokens.toLocaleString()
}

export function throughput(span: TraceSpan): number | null {
  return span.firstToken !== undefined && span.end !== null && span.end > span.firstToken && span.usage?.outputTokens !== undefined
    ? span.usage.outputTokens * 1000 / (span.end - span.firstToken) : null
}
