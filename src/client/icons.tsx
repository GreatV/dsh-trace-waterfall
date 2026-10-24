/** One stroke family for trace types and controls; no font-dependent pictograms. */
import type { ReactNode } from 'react'
import type { SpanKind, TraceSpan } from './model.ts'

const shapes: Record<SpanKind | 'nested' | 'search' | 'terminal' | 'network' | 'image' | 'chevronDown' | 'chevronRight' | 'focus' | 'fit' | 'close' | 'plus' | 'minus' | 'arrowRight' | 'open' | 'file' | 'error' | 'running', ReactNode> = {
  turn: <><path d="m2 5 6-3 6 3-6 3-6-3Z" /><path d="m2 8 6 3 6-3M2 11l6 3 6-3" /></>,
  llm: <><rect x="4" y="4" width="8" height="8" rx="2" /><path d="M6 1.5V4m4-2.5V4M6 12v2.5M10 12v2.5M1.5 6H4m-2.5 4H4m8-4h2.5M12 10h2.5" /><rect x="6.5" y="6.5" width="3" height="3" rx=".5" /></>,
  tool: <path d="M9.4 2a4 4 0 0 0-4.7 5.2l-3 3a2 2 0 0 0 2.8 2.8l3-3A4 4 0 0 0 13 5.4l-2.4 2.4-2.4-2.4L10.6 3" />,
  compaction: <><path d="M2 2h4v4M14 2h-4v4M2 14h4v-4m8 4h-4v-4M2 6l4-4m4 0 4 4M2 10l4 4m4 0 4-4" /></>,
  message: <path d="M3 2.5h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7l-4 2v-2H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />,
  context: <><path d="M4 2H2v12h2m8-12h2v12h-2M5.5 5h5m-5 3h5m-5 3h3" /></>,
  system: <><path d="M2 4h3m3 0h6M2 8h7m3 0h2M2 12h2m3 0h7" /><circle cx="6.5" cy="4" r="1.5" /><circle cx="10.5" cy="8" r="1.5" /><circle cx="5.5" cy="12" r="1.5" /></>,
  nested: <><circle cx="4" cy="3" r="1.5" /><circle cx="12" cy="6" r="1.5" /><circle cx="4" cy="13" r="1.5" /><path d="M4 4.5v7m0-7V6a3 3 0 0 0 3 3h2a3 3 0 0 0 3-1.5" /></>,
  search: <><circle cx="6.7" cy="6.7" r="4.5" /><path d="m10 10 3.8 3.8" /></>,
  terminal: <><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="m4 6 2 2-2 2m4 0h4" /></>,
  network: <><circle cx="8" cy="8" r="6" /><ellipse cx="8" cy="8" rx="2.5" ry="6" /><path d="M2 8h12" /></>,
  image: <><rect x="2" y="2" width="12" height="12" rx="2" /><circle cx="5.5" cy="5.5" r="1" /><path d="m2 11 3-3 2.5 2L10 7l4 5" /></>,
  chevronDown: <path d="m4 6 4 4 4-4" />,
  chevronRight: <path d="m6 4 4 4-4 4" />,
  focus: <><circle cx="8" cy="8" r="4" /><path d="M8 1.5V5m0 6v3.5M1.5 8H5m6 0h3.5" /></>,
  fit: <path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  plus: <path d="M8 3v10M3 8h10" />,
  minus: <path d="M3 8h10" />,
  arrowRight: <path d="M2 8h11m-4-4 4 4-4 4" />,
  open: <path d="M5 3h8v8M3 13 13 3" />,
  file: <><path d="M9 2H3v12h10V6L9 2Z" /><path d="M9 2v4h4M5 9h6m-6 3h4" /></>,
  error: <><circle cx="8" cy="8" r="6" /><path d="M8 4.5v4M8 11v.1" /></>,
  running: <><circle cx="8" cy="8" r="6" /><path d="M8 4v4l2.5 1.5" /></>,
}

/** Cosmetic tool families; classification never changes execution, filtering or accounting. */
export function spanTone(span: TraceSpan) {
  if (span.status === 'error') return 'error'
  if (span.nested) return 'nested'
  if (span.kind !== 'tool') return span.kind
  const name = span.name?.toLowerCase() ?? ''
  if (/image|audio|video|media|screenshot/.test(name)) return 'media'
  if (/glob|grep|search|find/.test(name)) return 'search'
  if (/browser|web|fetch|http|url/.test(name)) return 'network'
  if (/file|read|write|edit|patch|diff/.test(name)) return 'file'
  return 'shell'
}

export function spanIcon(span: TraceSpan): keyof typeof shapes {
  if (span.nested) return 'nested'
  if (span.kind !== 'tool') return span.kind
  const tone = spanTone({ ...span, status: 'complete' })
  return tone === 'media' ? 'image' : tone === 'shell' ? 'terminal' : tone === 'file' ? 'file' : tone === 'search' ? 'search' : tone === 'network' ? 'network' : 'tool'
}

export function TraceIcon({ name }: { name: keyof typeof shapes }) {
  return <svg className="tw-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>
}
