import { describe, expect, it } from 'vitest'
import { attachments, codeProgram, excerpt, requestInputSummary, spanSummary } from '../src/client/presentation.ts'
import type { TraceSpan } from '../src/client/model.ts'
import { t } from './fixture.ts'

const span: TraceSpan = { id: 'tool:program', name: 'run_code', kind: 'tool', start: 0, end: 5, anchor: 0, status: 'complete',
  input: JSON.stringify({ code: 'const value = 42\nreturn value', description: 'Read the project metadata' }),
  schema: { parameters: { properties: { code: { description: 'TypeScript source code' } } } } }

describe('progressive trace presentation', () => {
  it('uses the recorded program description and language without exposing the opaque identifier as its title', () => {
    expect(codeProgram(span)).toEqual({ source: 'const value = 42\nreturn value', description: 'Read the project metadata', language: 'typescript' })
    expect(spanSummary(span).input).toBe('Read the project metadata')
    expect(codeProgram({ ...span, schema: undefined })?.language).toBeUndefined()
    expect(codeProgram({ ...span, name: 'bash' })).toBeUndefined()
  })
  it('uses the command/path as secondary text and preserves the output summary', () => {
    expect(spanSummary({ ...span, name: 'bash', input: '{"command":"npm test","description":"Run checks"}', output: [{ type: 'text', text: 'All tests passed' }] }))
      .toEqual({ input: 'npm test', output: 'All tests passed' })
    expect(excerpt('before '.repeat(90) + 'needle after', 'needle', 100)).toContain('needle')
  })
  it('retains image and file references without treating arbitrary strings as image URLs', () => {
    const image = { attachmentId: 'image-reference', mediaType: 'image/png', width: 10, height: 20, bytes: 30, name: 'preview.png' }
    const file = { attachmentId: 'file-reference', bytes: 12, name: 'notes.txt' }
    expect(attachments([{ type: 'image', attachment: image }, { type: 'file', attachment: file }, { text: 'https://invalid.example/image.png' }]))
      .toEqual([{ ref: image, image: true }, { ref: file, image: false }])
  })
  it('reveals a model prompt match and never substitutes an unrelated request ID', () => {
    const request: TraceSpan = { ...span, id: 'request:1432', kind: 'llm', name: undefined, model: 'deepseek-flash',
      input: { messages: [{ role: 'user', content: [{ type: 'text', text: 'Inspect settings.gradle.kts before changing the build.' }] }] }, output: 'Inspecting the build.' }
    const result = spanSummary(request, 'settings.gradle.kts')
    expect(result.input).toContain('settings.gradle.kts')
    expect(result.input).not.toContain('request:1432')
    expect(spanSummary(request, 'unmatched').input).toBe('deepseek-flash')
    expect(spanSummary(request, 'request:1432').input).toBe('request:1432')
  })
  it('summarizes new input by intent and never falls back to a request configuration', () => {
    const request: TraceSpan = { ...span, kind: 'llm', input: { config: { provider: 'private-provider' }, system: 'Full system instructions', tools: [] },
      newInput: [{ kind: 'context', content: 'Workspace metadata' }, { kind: 'tool', name: 'bash', content: [{ type: 'text', text: 'Build passed' }] },
        { kind: 'message', content: [{ type: 'text', text: 'Now verify the build' }] }] }
    expect(requestInputSummary(request, t)).toBe('User message · Now verify the build')
    expect(requestInputSummary({ ...request, newInput: request.newInput!.slice(0, 2) }, t)).toBe('bash · Build passed')
    expect(requestInputSummary({ ...request, newInput: request.newInput!.slice(0, 1) }, t)).toBe('Context · Workspace metadata')
    expect(requestInputSummary({ ...request, newInput: [] }, t)).toBe('No new input in loaded history')
    expect(requestInputSummary({ ...request, newInput: undefined }, t)).not.toContain('private-provider')
  })
})
