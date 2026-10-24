/** Session-bound waterfall with a compressed time axis and a virtualized event ledger. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import type { ConvViewProps, MessageImageLoader } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TraceSpan, TraceModel } from './model.ts'
import { buildTrace, cacheRate, compactDuration, compactTokens, visibleRows } from './model.ts'
import type { TraceKey, TraceTranslate } from './locales.ts'
import { SpanDetails, SpanPopover, type PopoverAnchor } from './TraceDetails.tsx'
import { AXIS_HEIGHT, Handoffs, Overview, ROW_HEIGHT, TraceRowView } from './TraceTimeline.tsx'
import { clampWindow, compositeSegments, createTimeAxis, focusSpan, leafSegments, visibleGaps, zoomWindow, type TimeWindow } from './timeline.ts'
import styles from './waterfall.css'
import { TraceIcon } from './icons.tsx'
import { timelineTicks } from './timeline-layout.ts'

export interface TraceInjected { loadOlder: () => Promise<void>; loadImage?: MessageImageLoader }
type Props = Pick<ConvViewProps, 'useTrajectory' | 'useSession' | 'viewRequest' | 'completeViewRequest'>
  & Partial<Pick<ConvViewProps, 'useProjection'>> & InjectFace<TraceInjected> & PropsLocale<'trace-waterfall'>

function Metrics({ model, now, t, usage }: { model: TraceModel; now: number; t: TraceTranslate; usage?: TokenUsageProjection }) {
  // The public projection is the composer's whole-log source, including retries outside loaded history.
  const tokens = usage ? usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens : model.metrics.tokens
  const cache = usage ? cacheRate({ inputTokens: usage.uncachedInputTokens, ...usage }) : model.metrics.cacheRate
  const values: [TraceKey, string | number][] = [
    ['duration', compactDuration(model.spans.length ? Math.max(model.end, model.running ? now : model.end) - model.start : 0)],
    ['tokens', compactTokens(tokens)], ['llmCalls', model.metrics.llm], ['toolCalls', model.metrics.tools], ['errors', model.metrics.errors],
  ]
  return <dl className="tw-metrics">{values.map(([key, value]) => <div key={key} data-error={key === 'errors' && model.metrics.errors > 0 || undefined}
    title={key === 'tokens' ? `${tokens?.toLocaleString() ?? '—'} · ${t(usage ? 'sessionUsage' : 'loaded')}` : undefined}>
    <dt>{t(key)}</dt><dd>{value}{key === 'tokens' && cache !== null && <small>{t('cacheRate', { value: (cache * 100).toFixed(1) })}</small>}</dd></div>)}</dl>
}

/** Local interaction state never changes session execution or persisted history. */
export function TraceView({ useTrajectory, useSession, useProjection, loadOlder, loadImage, t, viewRequest, completeViewRequest }: Props) {
  const snapshot = useTrajectory(value => value)
  const model = useMemo(() => buildTrace(snapshot), [snapshot])
  const usage = useProjection?.('tokenUsage')
  const hasMore = useSession(value => value.hasMore)
  const loading = useSession(value => value.openState === 'loading' || value.loadingOlder)
  const openError = useSession(value => value.openError)
  const [query, setQuery] = useState(''), [errorsOnly, setErrorsOnly] = useState(false)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [selection, setSelection] = useState<string | null>(null)
  const [mode, setMode] = useState<'popover' | 'detail'>('popover')
  const [anchor, setAnchor] = useState<PopoverAnchor>({ left: 0, top: 0, bottom: 360 })
  const [dismissedRequest, setDismissedRequest] = useState<Props['viewRequest']>(null)
  const [range, setRange] = useState<TimeWindow | null>(null)
  const [scrollTarget, setScrollTarget] = useState<string | null>(null)
  const [labelWidth, setLabelWidth] = useState<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0), [height, setHeight] = useState(600)
  const [trackWidth, setTrackWidth] = useState(600)
  const [now, setNow] = useState(Date.now)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const search = useRef<HTMLInputElement>(null), scroller = useRef<HTMLDivElement>(null), root = useRef<HTMLElement>(null)
  const tickTrack = useRef<HTMLDivElement>(null)
  const resize = useRef<{ x: number; width: number } | null>(null)
  useEffect(() => {
    if (!model.running) return
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [model.running])
  useEffect(() => {
    if (!scroller.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => { for (const entry of entries) {
      if (entry.target === scroller.current) setHeight(entry.contentRect.height)
      if (entry.target === tickTrack.current) setTrackWidth(Math.max(1, entry.contentRect.width))
    } })
    observer.observe(scroller.current)
    if (tickTrack.current) observer.observe(tickTrack.current)
    return () => observer.disconnect()
  }, [])
  const requestedId = viewRequest?.view === 'trajectory' ? `tool:${viewRequest.focus}` : null
  const focusId = requestedId && viewRequest !== dismissedRequest && model.byId.has(requestedId) ? requestedId : null
  const selected = model.byId.get(focusId ?? selection ?? '')
  const detail = !!selected && (focusId !== null || mode === 'detail')
  const rows = useMemo(() => visibleRows(model, collapsed, query, errorsOnly, t), [model, collapsed, query, errorsOnly, t])
  useEffect(() => {
    if (!scrollTarget || !scroller.current) return
    const index = rows.findIndex(row => row.span.id === scrollTarget)
    if (index >= 0) { scroller.current.scrollTop = index * ROW_HEIGHT; setScrollTop(index * ROW_HEIGHT) }
    setScrollTarget(null)
  }, [rows, scrollTarget])
  const axis = useMemo(() => createTimeAxis(model, now), [model, now])
  // Wall time keeps the chosen viewport stable when older history is prepended.
  const window = range ? clampWindow({ from: axis.project(range.from), to: axis.project(range.to) }, axis.length) : { from: 0, to: axis.length }
  const zoom = axis.length / (window.to - window.from)
  const segmentMap = useMemo(() => {
    const descendants = (span: TraceSpan): TraceSpan[] => (model.children.get(span.id) ?? []).flatMap(child => [child, ...descendants(child)])
    return new Map(model.spans.map(span => [span.id, model.children.has(span.id) ? compositeSegments(span, descendants(span), now) : leafSegments(span, now)]))
  }, [model, now])
  const visibleCount = Math.ceil(height / ROW_HEIGHT) + 16
  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT))
  const startRow = Math.min(Math.max(0, rows.length - visibleCount), Math.max(0, firstVisible - 8))
  const rendered = rows.slice(startRow, startRow + visibleCount)
  const current = rows[Math.min(rows.length - 1, firstVisible)]
  const stickyIndex = current?.span.turn === undefined ? -1 : rows.findIndex(row => row.span.id === `turn:${current.span.turn}`)
  const sticky = stickyIndex >= 0 && stickyIndex < firstVisible ? rows[stickyIndex] : undefined
  const branches = [...model.children.keys()]
  const allCollapsed = branches.length > 0 && branches.every(key => collapsed.has(key))
  function resetScroll() { if (scroller.current) scroller.current.scrollTop = 0; setScrollTop(0) }
  function closeDetails() {
    setSelection(null); setDismissedRequest(viewRequest)
    if (requestedId) completeViewRequest()
  }
  function changeWindow(value: TimeWindow) {
    const clamped = clampWindow(value, axis.length)
    setRange({ from: axis.unproject(clamped.from), to: axis.unproject(clamped.to) })
  }
  function focus(span: TraceSpan) {
    changeWindow(focusSpan(axis, span, now))
    setCollapsed(previous => { const next = new Set(previous); next.delete(span.id); return next })
    setScrollTarget(span.id)
  }
  function zoomBy(factor: number) {
    const center = selected ? axis.project(((selected.start ?? selected.anchor) + (selected.end ?? now)) / 2) : undefined
    changeWindow(zoomWindow(window, factor, axis.length, center))
  }
  function inspect(event: MouseEvent<HTMLButtonElement>, span: TraceSpan) {
    const parent = root.current?.getBoundingClientRect(), target = event.currentTarget.getBoundingClientRect()
    if (parent) {
      const x = event.currentTarget.classList.contains('tw-track') && event.detail > 0 ? event.clientX : target.right
      const top = target.bottom - parent.top + 7
      const usableHeight = parent.height - parseFloat(getComputedStyle(root.current!).paddingBottom || '0')
      const available = usableHeight - top - 10
      setAnchor({ left: Math.max(8, Math.min(parent.width - 338, x - parent.left - 80)),
        top: available > 280 ? top : Math.max(54, target.top - parent.top - 300), bottom: Math.max(260, Math.min(380, parent.height - 65)) })
    }
    setSelection(span.id); setMode('popover'); setDismissedRequest(viewRequest)
    if (focusId) completeViewRequest()
  }
  useEffect(() => {
    if (!selected || detail) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('.tw-popover, .tw-label-button, .tw-track')) setSelection(null)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [selected, detail])
  const renderRow = (row: typeof rows[number], index: number, isSticky = false) => <TraceRowView key={row.span.id} row={row} index={index} axis={axis} window={window}
    segments={segmentMap.get(row.span.id) ?? []} trackWidth={trackWidth} now={now} t={t} query={query} selected={selected?.id === row.span.id} sticky={isSticky}
    expanded={query.trim() !== '' || errorsOnly || !collapsed.has(row.span.id)} inspect={inspect} focus={() => focus(row.span)}
    collapse={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(row.span.id)) next.delete(row.span.id); else next.add(row.span.id); return next })} />
  const gaps = visibleGaps(axis, window)
  const tickOrigin = range ? axis.unproject(window.from) : model.start
  const ticks = timelineTicks(axis, window, tickOrigin, trackWidth)
  const shortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd F' : 'Ctrl F'
  return <section className="tw-root" ref={root} data-conversation-composer-overlay="" aria-label={t('timeline')}
    style={labelWidth === null ? undefined : { '--tw-label-width': `${labelWidth}px` } as CSSProperties}
    onKeyDown={event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); search.current?.focus() }
      if (event.key === 'Escape') { if (selected) closeDetails(); else { setQuery(''); setErrorsOnly(false); resetScroll() } }
    }}>
    <style>{styles}</style>
    <header className="tw-header"><div className="tw-heading"><div className="tw-title"><h2>{t('title')}</h2>{model.running && <span className="tw-live"><i />{t('live')}</span>}</div>
      <label className="tw-search"><TraceIcon name="search" /><input ref={search} type="search" value={query} aria-label={t('search')} aria-keyshortcuts="Meta+F Control+F" placeholder={t('search')}
        onChange={event => { setQuery(event.target.value); setRange(null); resetScroll() }} /><kbd>{shortcut}</kbd></label></div>
      <Metrics model={model} now={now} usage={usage} t={t} />
    </header>
    <div className="tw-toolbar"><div className="tw-filters"><button aria-pressed={!errorsOnly} onClick={() => { setErrorsOnly(false); resetScroll() }}>{t('all')}</button>
      <button aria-pressed={errorsOnly} onClick={() => { setErrorsOnly(true); setRange(null); resetScroll() }}>{t('onlyErrors')}{model.metrics.errors > 0 && <span>{model.metrics.errors}</span>}</button></div>
      {hasMore && <button className="tw-load" disabled={loading} onClick={async () => { setHistoryError(null); try { await loadOlder() } catch (error) { setHistoryError(error instanceof Error ? error.message : String(error)) } }}>{t(loading ? 'loading' : 'loadOlder')}</button>}
      {range && <span className="tw-range-label">{t('rangeStart', { time: new Date(tickOrigin).toLocaleTimeString() })}</span>}
      <div className="tw-controls"><button onClick={() => { setCollapsed(allCollapsed ? new Set() : new Set(branches)); resetScroll() }} disabled={!branches.length}>{t(allCollapsed ? 'expandAll' : 'collapseAll')}</button>
        <span className="tw-divider" /><button aria-label={t('zoomOut')} title={t('zoomOut')} disabled={zoom <= 1.001} onClick={() => zoomBy(.5)}><TraceIcon name="minus" /></button>
        <button onClick={() => setRange(null)} title={t('fit')}>{zoom < 1.01 ? '1' : zoom.toFixed(1)}×</button>
        <button aria-label={t('zoomIn')} title={t('zoomIn')} onClick={() => zoomBy(2)}><TraceIcon name="plus" /></button></div></div>
    <Overview model={model} axis={axis} window={window} change={changeWindow} reset={() => setRange(null)} t={t} now={now} />
    {(openError || historyError) && <div role="alert" className="tw-history-error">{t('historyError', { reason: openError?.message ?? historyError ?? '' })}</div>}
    <div className="tw-main"><div className="tw-chart">
      <div className="tw-scroll" ref={scroller} onScroll={event => { setScrollTop(event.currentTarget.scrollTop); if (mode === 'popover') setSelection(null) }}>
        <div className="tw-axis"><div className="tw-axis-label">{t('steps')}<span>{rows.length}</span>
          <div className="tw-resizer" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={t('resizeLabels')} aria-valuenow={labelWidth ?? 560}
            onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setLabelWidth(value => Math.max(260, Math.min((root.current?.clientWidth ?? 1000) - 230, (value ?? 560) + (event.key === 'ArrowLeft' ? -24 : 24)))) } }}
            onPointerDown={event => { event.currentTarget.setPointerCapture?.(event.pointerId); resize.current = { x: event.clientX, width: event.currentTarget.parentElement!.getBoundingClientRect().width } }}
            onPointerMove={event => { if (resize.current) setLabelWidth(Math.max(260, Math.min((root.current?.clientWidth ?? 1000) - 230, resize.current.width + event.clientX - resize.current.x))) }}
            onPointerUp={() => { resize.current = null }} onPointerCancel={() => { resize.current = null }} />
        </div><div className="tw-ticks" ref={tickTrack}>{ticks.map(tick => <span key={tick.left} style={{ left: `${tick.left}%` }}>{tick.label}</span>)}
          {gaps.map(gap => <em key={gap.start} className="tw-break-label" style={{ left: `${((gap.from + gap.to) / 2 - window.from) / (window.to - window.from) * 100}%` }} title={new Date(gap.start).toLocaleString() + ' → ' + new Date(gap.end).toLocaleString()}>⋯ {t('idle', { duration: compactDuration(gap.end - gap.start) })}</em>)}
        </div></div>
        {sticky && <div className="tw-sticky" style={{ top: AXIS_HEIGHT }}>{renderRow(sticky, stickyIndex, true)}</div>}
        {!rows.length ? <div className="tw-empty"><h3>{t(model.spans.length ? 'noMatches' : 'empty')}</h3><p>{t(loading ? 'loading' : model.spans.length ? 'noMatchesHint' : 'emptyHint')}</p>
          {(query || errorsOnly) && <button onClick={() => { setQuery(''); setErrorsOnly(false); resetScroll() }}>{t('clear')}</button>}</div>
          : <div role="list" aria-label={t('steps')} className="tw-rows" style={{ height: rows.length * ROW_HEIGHT }}>
            <div className="tw-gridlines">{ticks.map(tick => <i key={tick.left} style={{ left: `${tick.left}%` }} />)}</div>
            <div className="tw-breaks">{gaps.map(gap => <i key={gap.start} style={{ left: `${((gap.from + gap.to) / 2 - window.from) / (window.to - window.from) * 100}%` }} />)}</div>
            <Handoffs rows={rows} axis={axis} window={window} start={startRow} end={startRow + visibleCount} />
            {rendered.map((row, i) => renderRow(row, startRow + i))}
          </div>}
      </div>
      <footer className="tw-footer"><span>{t('shown', { shown: rows.length, total: model.spans.length })}</span><div className="tw-legend" aria-label={t('legend')}>
        {(['llm', 'tool', 'waiting', 'nested', 'error'] as const).map(kind => <span key={kind}><i data-activity={kind}>{kind === 'error' && <TraceIcon name="close" />}</i>{t(kind === 'error' ? 'failed' : kind)}</span>)}</div></footer>
    </div>{selected && detail && <SpanDetails key={selected.id} span={selected} origin={tickOrigin} now={now} t={t} close={closeDetails} loadImage={loadImage} />}</div>
    {selected && !detail && <SpanPopover key={selected.id} span={selected} origin={tickOrigin} now={now} t={t} close={closeDetails} loadImage={loadImage} anchor={anchor} fullDetails={() => setMode('detail')} />}
  </section>
}
