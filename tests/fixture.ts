/** Deterministic records exercise the same snapshot consumed in DSH. */
import { PartialArguments } from '@deepseek-ai/dsh-util-values'
import type { ConversationLocation, ToolResultNode } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TrajectorySnapshot } from '../src/client/adapter/trajectory-contract.ts'
import { en } from '../src/client/locales.ts'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

export const t: TranslateNS<'trace-waterfall'> = (key, params) => {
  const dictionary: Record<string, string> = en
  let text: string = dictionary[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll(`{${name}}`, String(value))
  return text
}
export const BASE = 1_700_000_000_000
const data = { get: () => undefined, source: () => ({ getSnapshot: () => undefined, subscribe: () => () => {} }) }
const location: ConversationLocation = {
  kind: 'step',
  step: { turn: 1, step: 1, start: undefined, end: undefined, status: 'closed', data },
  turn: { turn: 1, start: undefined, end: undefined, status: 'closed', steps: [], data },
}
export function tool(callId: string, name: string, start: number | null, end: number, isError = false): ToolResultNode {
  return { kind: 'tool-result', seq: end, time: BASE + end, name, callId,
    call: start === null ? null : { name, argsRaw: '{"path":"src/index.ts"}' },
    callTime: start === null ? null : BASE + start, args: PartialArguments.EMPTY,
    content: [{ type: 'text', text: isError ? 'Permission denied' : 'export const answer = 42' }],
    isError, subCalls: [], ...(isError ? { error: { name: 'PermissionError', code: 'DENIED', reason: 'Permission denied' } } : {}) }
}
export function fixture(): TrajectorySnapshot {
  const call = tool('read', 'read_file', 2000, 3500)
  const parallel = tool('search', 'search_files', 2100, 3000, true)
  return {
    eventNodes: [
      { kind: 'user', seq: 1, time: BASE, content: [{ type: 'text', text: 'Explain the codebase' }], source: null },
      { kind: 'assistant', seq: 2, time: BASE + 2000, turn: 1, step: 1,
        blocks: [{ kind: 'reasoning', text: 'First inspect the source.' }],
        timing: { stepStartTime: BASE + 100, firstTokenTime: BASE + 400, completedTime: BASE + 2000 } },
      { ...call, subCalls: [tool('nested', 'stat_file', 2300, 2800)] }, parallel,
    ],
    eventLocations: new Map([[1, location], [2, location], [3500, location], [3000, location]]),
    requests: [{ purpose: 'assistant', startSeq: 2, turn: 1, step: 1, startedAt: BASE + 100,
      completedAt: BASE + 2000, status: 'complete', providerMetadata: { provider: 'deepseek', model: 'deepseek-chat' },
      usage: { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 800, reasoningTokens: 50 } }],
    partial: null, runningCalls: [], callSchemas: new Map(),
  }
}
