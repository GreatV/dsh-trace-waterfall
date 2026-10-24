/** Concise ledger text and durable attachment references, derived only from recorded values. */
import type { FileAttachmentRef, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { TraceSpan } from './model.ts'
import { payloadText } from './model.ts'
import type { TraceTranslate } from './locales.ts'

export function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try { return record(JSON.parse(value)) } catch { return undefined }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

export function summary(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (Array.isArray(value)) return value.map(summary).filter(Boolean).join(' · ')
  const object = record(value)
  if (!object) return String(value)
  if (typeof object.text === 'string') return summary(object.text)
  if (object.content !== undefined) return summary(object.content)
  if (object.blocks !== undefined) return summary(object.blocks)
  if (object.messages !== undefined) return summary(object.messages)
  if (object.attachment !== undefined) return summary(record(object.attachment)?.name)
  if (object.kind === 'tool-call' || object.type === 'tool-call') return String(object.name ?? '')
  return JSON.stringify(value)
}

/** Prefer the new user intent, then tool results, then freshly introduced context. */
export function requestInputSummary(span: TraceSpan, t: TraceTranslate): string {
  for (const kind of ['message', 'tool', 'context'] as const) {
    const entries = span.newInput?.filter(input => input.kind === kind && summary(input.content))
    if (entries?.length) return entries.slice(-3).reverse()
      .map(input => `${input.name || t(kind)} · ${summary(input.content)}`).join(' · ')
  }
  return t('noNewInput')
}

export interface Program { source: string; description: string; language?: 'typescript' | 'python' }
/** Language comes from the recorded run_code schema, matching DSH's original inspector. */
export function codeProgram(span: TraceSpan): Program | undefined {
  if (span.name !== 'run_code') return undefined
  const args = record(span.input)
  if (typeof args?.code !== 'string') return undefined
  const schema = record(span.schema)
  const properties = record(record(schema?.parameters)?.properties)
  const description = record(properties?.code)?.description
  const ts = typeof description === 'string' && /\bTypeScript\b/i.test(description)
  const py = typeof description === 'string' && /\bPython\b/i.test(description)
  return { source: args.code, description: typeof args.description === 'string' ? args.description : args.code.split(/\r?\n/).find(line => line.trim()) ?? '',
    language: ts === py ? undefined : ts ? 'typescript' : 'python' }
}

/** Prefer tool intent and its primary argument; keep output available on every row. */
export function spanSummary(span: TraceSpan, query = ''): { input: string; output: string } {
  const args = record(span.input)
  const delegated = span.name === 'spawn_teammate' && args ? [args.name, args.description].filter(value => typeof value === 'string').join(' · ') : undefined
  const primary = codeProgram(span)?.description ?? delegated ?? (args && [args.command, args.path, args.file_path, args.pattern, args.query, args.url, args.description, args.prompt].find(value => typeof value === 'string'))
  let input = span.kind === 'llm' ? span.model ?? '' : summary(primary ?? span.input)
  const output = summary(span.output)
  const term = query.trim().toLocaleLowerCase()
  if (term) {
    const matches = (text: string) => text.toLocaleLowerCase().includes(term)
    const prompt = summary(span.newInput ?? span.input)
    if (!matches(input) && matches(prompt)) input = prompt
    if (![input, output, span.name ?? ''].some(matches)) {
      const match = [span.error, span.provider, payloadText(span.newInput), payloadText(span.input), payloadText(span.output)].find(value => value && matches(value))
      if (match) input = match
      else if (span.id.toLocaleLowerCase() === term) input = span.id
    }
  }
  return { input, output }
}

/** Reveal a matching excerpt even when the match is deep inside a long command or result. */
export function excerpt(text: string, query: string, limit = 240): string {
  const normalized = text.replace(/\s+/g, ' ')
  const index = query.trim() ? normalized.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase()) : -1
  const from = index > 32 ? Math.max(0, index - 16) : 0
  return (from ? '…' : '') + normalized.slice(from, from + limit) + (normalized.length > from + limit ? '…' : '')
}

export interface Attachment { ref: ImageAttachmentRef | FileAttachmentRef; image: boolean }
/** Inspect content block containers only; arbitrary JSON fields do not become image URLs. */
export function attachments(value: unknown): Attachment[] {
  const found = new Map<string, Attachment>()
  function visit(item: unknown, depth: number) {
    if (depth > 12) return
    if (Array.isArray(item)) { item.forEach(child => visit(child, depth + 1)); return }
    const object = item !== null && typeof item === 'object' ? record(item) : undefined
    if (!object) return
    const attachment = object.attachment ?? object.file
    const ref = record(attachment)
    if (ref && typeof ref.attachmentId === 'string') {
      const isImage = typeof ref.mediaType === 'string' && ref.mediaType.startsWith('image/')
      found.set(ref.attachmentId, { ref: attachment as ImageAttachmentRef | FileAttachmentRef, image: isImage })
    }
    for (const key of ['content', 'blocks', 'messages', 'images']) if (object[key] !== undefined) visit(object[key], depth + 1)
  }
  visit(value, 0)
  return [...found.values()]
}
