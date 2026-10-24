/** Exercise the shipped module factory and replay through DSH's real assembler. */
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { describe, expect, it } from 'vitest'
import { ConversationNodeAssembler } from '../node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/types/client/conversation/assembler.js'
import { inspectRequestPrompt } from '../node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/request-inspection.js'
import { inspectSystemPrompt } from '../node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/system-prompt.js'
import { buildTrace } from '../src/client/model.ts'

function load() {
  let handoff
  runInNewContext(readFileSync('lib/client.js', 'utf8'), { window: { __ModuleLoader__: { load(value) { handoff = value } } } })
  const requested = []
  const plugin = handoff.factory(name => {
    requested.push(name)
    if (name === 'react') return React
    if (name === 'react/jsx-runtime') return jsx
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { CodeBlock: () => null }
    throw new Error(`Unexpected shared module: ${name}`)
  })
  const definitions = [], views = [], slots = [], providers = [], disposers = []
  const register = list => value => { list.push(value); const dispose = () => list.splice(list.indexOf(value), 1); disposers.push(dispose); return dispose }
  const ctx = {
    effect: fn => { disposers.push(fn()); },
    locale: { register: () => () => {}, bind: () => key => key },
    uiConversation: { events: { register: register(definitions) }, views: { register: register(views) }, inspectRequestPrompt, inspectSystemPrompt },
    uiSession: { provide: register(providers) },
    slots: { inject: (_slot, fn) => fn(), register: (options, component) => register(slots)({ options, component }) },
  }
  plugin.apply(ctx)
  const assembler = new ConversationNodeAssembler(
    { entries: () => definitions, fallbackEntry: () => undefined }, { entries: () => views },
  )
  return { handoff, plugin, requested, definitions, views, slots, providers, assembler,
    dispose: () => { for (const fn of disposers.reverse()) fn() } }
}
const at = (seq, type, data) => ({ type: 'event', event: { seq, time: 1000 + seq * 100, type, data } })
const message = (id, text) => ({ id, role: 'assistant', content: [{ type: 'text', text }], source: { kind: 'model', provider: 'deepseek', model: 'deepseek-chat' } })

describe('built DSH plugin', () => {
  it('uses host React and code rendering while replacing the established trajectory view ID', () => {
    const value = load()
    expect(value.handoff.id).toBe('dsh-trace-waterfall')
    expect(Object.keys(value.plugin).sort()).toEqual(['apply', 'inject'])
    expect(new Set(value.requested)).toEqual(new Set(['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives']))
    expect(value.slots.map(slot => slot.options.id)).toEqual(['trajectory'])
    expect(value.providers[0].hooks).toEqual(['trajectory'])
    expect(value.views[0].toolCallFocus('call-1')).toBe('call-1')
    expect(value.definitions.length).toBeGreaterThan(5)
    value.dispose()
    expect(value.slots).toHaveLength(0)
    expect(value.views).toHaveLength(0)
    expect(value.definitions).toHaveLength(0)
  })
  it('replays real turn, assistant and nested PTC events into the waterfall', () => {
    const { assembler } = load()
    assembler.replaceWindow([
      at(1, 'turn/start', { turn: 1 }), at(2, 'step/start', { turn: 1, step: 1 }),
      at(3, 'assistant/message', { turn: 1, step: 1, message: message('m1', 'Inspect the source.'), stream: [], usage: { inputTokens: 100, outputTokens: 20 } }),
      at(4, 'tool/call', { turn: 1, step: 1, callId: 'root', name: 'run_code', arguments: '{"code":"read_file()"}' }),
      at(5, 'tool/ptc-dispatch-start', { rootCallId: 'root', parentCallId: 'root', subCallId: 'child', name: 'read_file', arguments: { path: 'index.ts' } }),
      at(6, 'tool/ptc-dispatch', { rootCallId: 'root', parentCallId: 'root', subCallId: 'child', name: 'read_file', arguments: { path: 'index.ts' }, isError: false, content: [{ type: 'text', text: 'file content' }] }),
      at(7, 'tool/result', { turn: 1, step: 1, message: { role: 'tool', toolCallId: 'root', id: 'result1', source: { kind: 'tool', callId: 'root' }, content: [{ type: 'text', text: 'done' }] } }),
      at(8, 'step/end', { turn: 1, step: 1 }), at(9, 'turn/end', { turn: 1, reason: { kind: 'completed' } }),
    ], false)
    assembler.activateTarget('trajectory')
    const model = buildTrace(assembler.get('trajectory'))
    expect(model.metrics).toEqual({ llm: 1, tools: 2, errors: 0, tokens: 120, cacheRate: 0 })
    expect(model.byId.get('tool:child')).toMatchObject({ parentId: 'tool:root', start: 1500, end: 1600 })
    expect(model.byId.get('tool:root')?.parentId).toBe('turn:1')
    expect(model.byId.get('turn:1')).toMatchObject({ start: 1100, end: 1900, status: 'complete' })
    expect(model.running).toBe(false)
  })
  it('publishes live requests and freezes interrupted streams on a closing boundary', () => {
    const { assembler } = load()
    assembler.replaceWindow([
      at(1, 'turn/start', { turn: 1 }), at(2, 'step/start', { turn: 1, step: 1 }),
      at(3, 'assistant/live-chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'Still working' } }),
    ], false)
    assembler.activateTarget('trajectory')
    expect(buildTrace(assembler.get('trajectory')).running).toBe(true)
    assembler.append(at(4, 'step/end', { turn: 1, step: 1 }))
    assembler.append(at(5, 'turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'legacy' } } }))
    assembler.flush()
    const model = buildTrace(assembler.get('trajectory'))
    expect(model.running).toBe(false)
    expect(model.metrics.errors).toBe(1)
    expect(model.spans.find(span => span.kind === 'llm')?.output).toEqual([{ kind: 'text', text: 'Still working' }])
  })
})
