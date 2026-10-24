/** Anchored summaries and the complete source/JSON inspector. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { MessageImageLoader } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TraceSpan } from './model.ts'
import { compactDuration, compactTokens, payloadText, spanLabel, throughput, totalTokens } from './model.ts'
import type { TraceKey, TraceTranslate } from './locales.ts'
import { attachments, codeProgram, excerpt, requestInputSummary, spanSummary } from './presentation.ts'
import { TraceIcon, spanIcon, spanTone } from './icons.tsx'

export function Highlight({ text, query }: { text: string; query: string }) {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return <>{text}</>
  const lower = text.toLocaleLowerCase(), parts = []
  let cursor = 0, index = lower.indexOf(term)
  while (index >= 0) {
    parts.push(text.slice(cursor, index), <mark key={index}>{text.slice(index, index + term.length)}</mark>)
    cursor = index + term.length; index = lower.indexOf(term, cursor)
  }
  parts.push(text.slice(cursor))
  return <>{parts}</>
}

function Thumbnail({ attachment, load, t }: { attachment: ImageAttachmentRef; load: MessageImageLoader; t: TraceTranslate }) {
  const [url, setUrl] = useState(() => load.peek?.(attachment))
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let active = true
    void load(attachment).then(value => { if (active) setUrl(value) }, () => { if (active) setFailed(true) })
    return () => { active = false }
  }, [attachment, load])
  return url ? <button className="tw-thumbnail" data-expanded={expanded || undefined} onClick={() => setExpanded(value => !value)} title={t('imagePreview')}>
    <img src={url} alt={attachment.name ?? t('image')} loading="lazy" /></button>
    : <span className="tw-file-preview">{t(failed ? 'imageFailed' : 'loading')}</span>
}

export function Attachments({ value, loadImage, t }: { value: unknown; loadImage?: MessageImageLoader; t: TraceTranslate }) {
  const items = useMemo(() => attachments(value), [value])
  if (!items.length) return null
  return <div className="tw-attachments" aria-label={t('attachments')}>{items.map(({ ref, image }) => <div className="tw-attachment" key={ref.attachmentId}>
    {image && loadImage ? <Thumbnail attachment={ref as ImageAttachmentRef} load={loadImage} t={t} /> : <span className="tw-file-icon" aria-hidden="true"><TraceIcon name="file" /></span>}
    <span title={ref.name}>{ref.name ?? t(image ? 'image' : 'file')}</span>
  </div>)}</div>
}

export interface DetailProps { span: TraceSpan; origin: number; now: number; t: TraceTranslate; close: () => void; loadImage?: MessageImageLoader }
export function SpanDetails({ span, origin, now, t, close, loadImage }: DetailProps) {
  const program = codeProgram(span)
  const [tab, setTab] = useState<'source' | 'input' | 'output' | 'metadata'>(program ? 'source' : span.output === undefined ? 'input' : 'output')
  const [copy, setCopy] = useState<'copy' | 'copied' | 'copyError'>('copy')
  const value = tab === 'source' ? program?.source
    : tab === 'input' && span.kind === 'llm' ? { prompt: span.input, newInput: span.newInput } : span[tab]
  const text = payloadText(value)
  const speed = throughput(span)
  const metrics: [TraceKey, string | number][] = [
    ['status', t(span.status)], ['duration', compactDuration(span.start === null ? null : (span.end ?? now) - span.start)],
    ['start', compactDuration(span.start === null ? null : span.start - origin, true)],
  ]
  if (span.model) metrics.push(['model', span.model])
  if (span.provider) metrics.push(['provider', span.provider])
  if (span.usage?.inputTokens !== undefined) metrics.push(['inputTokens', span.usage.inputTokens.toLocaleString()])
  if (span.usage?.outputTokens !== undefined) metrics.push(['outputTokens', span.usage.outputTokens.toLocaleString()])
  if (span.usage?.cacheReadTokens !== undefined) metrics.push(['cacheTokens', span.usage.cacheReadTokens.toLocaleString()])
  if (span.usage?.cacheWriteTokens !== undefined) metrics.push(['cacheWriteTokens', span.usage.cacheWriteTokens.toLocaleString()])
  if (span.usage?.reasoningTokens !== undefined) metrics.push(['reasoningTokens', span.usage.reasoningTokens.toLocaleString()])
  if (span.firstToken !== undefined && span.start !== null) metrics.push(['firstToken', compactDuration(span.firstToken - span.start)])
  if (speed !== null) metrics.push(['throughput', `${speed.toFixed(1)} tok/s`])
  if (span.retries) metrics.push(['retries', span.retries])
  return <aside className="tw-details" aria-label={t('details')}>
    <header><strong>{spanLabel(span, t)}</strong><button className="tw-icon-button" onClick={close} aria-label={t('close')}><TraceIcon name="close" /></button></header>
    <div className="tw-details-body">
      <span className="tw-status" data-status={span.status}><i />{t(span.status)}</span>
      <code className="tw-identity">{span.id}</code>
      <dl className="tw-properties">{metrics.map(([key, amount]) => <div key={key}><dt>{t(key)}</dt><dd>{amount}</dd></div>)}</dl>
      {span.start === null && <p className="tw-notice">{t('unknownTiming')}</p>}
      {span.error && <p className={span.status === 'error' ? 'tw-error' : 'tw-notice'}>{span.error === 'trajectory.compaction-interrupted' ? t('interrupted') : span.error}</p>}
      <div className="tw-detail-tabs" aria-label={t('details')}>
        {([...(program ? ['source' as const] : []), 'input', 'output', 'metadata'] as const).map(key => <button key={key} aria-pressed={key === tab}
          onClick={() => { setTab(key); setCopy('copy') }}>{t(key)}</button>)}
      </div>
      <div className="tw-code-heading"><span>{t(tab)}</span>{text && <button onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopy('copied') }
        catch { setCopy('copyError') }
      }}>{t(copy === 'copyError' ? 'copy' : copy)}</button>}</div>
      {copy === 'copyError' && <p role="alert" className="tw-error">{t('copyError')}</p>}
      {tab === 'source' && program ? <CodeBlock code={program.source} lang={program.language} lineNumbers showHeader={false} copyLabel={t('copy')} copiedLabel={t('copied')} />
        : text ? <><Attachments value={value} loadImage={loadImage} t={t} /><pre tabIndex={0}>{text}</pre></> : <p className="tw-no-payload">{t(span.status === 'running' && tab === 'output' ? 'pending' : 'noPayload')}</p>}
    </div>
  </aside>
}

export interface PopoverAnchor { left: number; top: number; bottom: number }
export function SpanPopover({ span, origin, now, t, close, fullDetails, anchor, loadImage }: DetailProps & { anchor: PopoverAnchor; fullDetails: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  const content = spanSummary(span)
  if (span.kind === 'llm') content.input = requestInputSummary(span, t)
  useEffect(() => { card.current?.focus({ preventScroll: true }) }, [])
  return <div className="tw-popover" role="dialog" aria-label={t('summary')} tabIndex={-1} ref={card}
    style={{ left: anchor.left, top: anchor.top, maxHeight: anchor.bottom }}>
    <header><span className="tw-kind" data-kind={span.kind} data-tone={spanTone(span)} data-nested={span.nested || undefined}><TraceIcon name={spanIcon(span)} /></span><strong>{spanLabel(span, t)}</strong>
      <span className="tw-status" data-status={span.status}>{t(span.status)}</span><button aria-label={t('close')} onClick={close}><TraceIcon name="close" /></button></header>
    <dl className="tw-popover-metrics">
      <div><dt>{t('duration')}</dt><dd>{compactDuration(span.start === null ? null : (span.end ?? now) - span.start)}</dd></div>
      <div><dt>{t('start')}</dt><dd>{compactDuration(span.start === null ? null : span.start - origin, true)}</dd></div>
      <div><dt>{t('tokens')}</dt><dd>{compactTokens(totalTokens(span.usage))}</dd></div>
    </dl>
    {(['input', 'output'] as const).map(key => <section key={key}><label>{t(key === 'input' && span.kind === 'llm' ? 'newInput' : key)}</label><p data-code={key === 'input' && span.kind === 'tool' || undefined}>{excerpt(content[key], '', 260) || t(key === 'output' && span.status === 'running' ? 'pending' : 'noPayload')}</p></section>)}
    <Attachments value={[span.newInput, span.output ?? span.input]} loadImage={loadImage} t={t} />
    <footer><span>{span.firstToken !== undefined && span.start !== null ? `${t('firstTokenShort')} ${compactDuration(span.firstToken - span.start)}` : ''}</span><button onClick={fullDetails}>{t('fullDetails')}<TraceIcon name="open" /></button></footer>
  </div>
}
