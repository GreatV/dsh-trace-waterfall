/** Dense ledger rows, segmented bars, and the draggable session overview. */
import { useMemo, useRef } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import type { TraceModel, TraceRow, TraceSpan } from './model.ts'
import { compactDuration, compactTokens, spanLabel, totalTokens } from './model.ts'
import { excerpt, spanSummary } from './presentation.ts'
import { Highlight } from './TraceDetails.tsx'
import { TraceIcon, spanIcon, spanTone } from './icons.tsx'
import type { TraceTranslate } from './locales.ts'
import type { ActivitySegment, TimeAxis, TimeWindow } from './timeline.ts'
import { intervalPosition } from './timeline.ts'
import { compositeLayout } from './timeline-layout.ts'
import { overviewPath, overviewRuns } from './overview.ts'

export const ROW_HEIGHT = 28
export const AXIS_HEIGHT = 30

export function SpanBadge({ span, t }: { span: TraceSpan; t: TraceTranslate }) {
  return <span className="tw-kind" data-kind={span.kind} data-tone={spanTone(span)} data-nested={span.nested || undefined} title={t(span.nested ? 'nested' : span.kind)} aria-hidden="true">
    <TraceIcon name={spanIcon(span)} />
  </span>
}

export function TraceRowView({ row, index, axis, window, trackWidth, segments, now, t, query, selected, expanded, inspect, collapse, focus, sticky = false }: {
  row: TraceRow; index: number; axis: TimeAxis; window: TimeWindow; segments: readonly ActivitySegment[]; now: number; t: TraceTranslate;
  trackWidth: number;
  query: string; selected: boolean; expanded: boolean; inspect: (event: MouseEvent<HTMLButtonElement>, span: TraceSpan) => void;
  collapse: () => void; focus: () => void; sticky?: boolean;
}) {
  const { span, depth, hasChildren } = row
  const label = spanLabel(span, t), content = useMemo(() => spanSummary(span, query), [span, query])
  const position = intervalPosition(axis, window, span.start ?? span.anchor, span.end ?? now)
  const instant = ['message', 'context', 'system'].includes(span.kind) && (span.start === null || span.start === span.end)
  const painted = useMemo(() => hasChildren ? compositeLayout(segments, axis, window, trackWidth) : [], [hasChildren, segments, axis, window, trackWidth])
  const spanDuration = compactDuration(span.start === null ? null : (span.end ?? now) - span.start)
  const tokens = totalTokens(span.usage)
  const matches = query.trim().toLocaleLowerCase()
  const input = excerpt(content.input, query, 260), output = excerpt(content.output, query, 260)
  const showOutput = !!output && (!matches || output.toLocaleLowerCase().includes(matches))
  return <div role={sticky ? undefined : 'listitem'} className={sticky ? 'tw-row tw-sticky-row' : 'tw-row'} data-selected={selected || undefined}
    data-kind={span.kind} data-nested={span.nested || undefined} data-searching={!!matches || undefined} style={{ top: sticky ? undefined : index * ROW_HEIGHT, '--tw-depth': Math.min(depth, 10) } as CSSProperties}>
    <div className="tw-row-label">
      {Array.from({ length: Math.min(depth, 10) }, (_, level) => <i key={level} className="tw-tree-guide" style={{ left: 13 + level * 13 }} />)}
      {hasChildren ? <button className="tw-disclosure" aria-expanded={expanded} aria-label={t(expanded ? 'collapse' : 'expand', { name: label })} onClick={collapse}><TraceIcon name={expanded ? 'chevronDown' : 'chevronRight'} /></button> : <span className="tw-disclosure-space" />}
      <button className="tw-label-button" onClick={event => inspect(event, span)} aria-label={t('inspect', { name: label })} title={[label, excerpt(content.input, '', 180), excerpt(content.output, '', 220)].filter(Boolean).join(' → ')}>
        <SpanBadge span={span} t={t} /><strong className="tw-label-name"><Highlight text={label} query={query} /></strong>
        <span className="tw-ledger-text" data-output={showOutput || undefined}><span className="tw-input-summary"><Highlight text={input} query={query} /></span>
          {showOutput && <><span className="tw-arrow"><TraceIcon name="arrowRight" /></span><span className="tw-output-summary"><Highlight text={output} query={query} /></span></>}
        </span>
        {span.status !== 'complete' && <span className="tw-row-status" data-status={span.status} aria-label={t(span.status)}><TraceIcon name={span.status} /></span>}
      </button>
      {!!span.errorCount && <span className="tw-error-count" title={t('errorCount', { count: span.errorCount })}>{span.errorCount}</span>}
      {hasChildren && <button className="tw-focus" title={t('focus', { name: label })} aria-label={t('focus', { name: label })} onClick={focus}><TraceIcon name="focus" /></button>}
    </div>
    <button className="tw-track" tabIndex={-1} aria-label={t('inspect', { name: label })} onClick={event => inspect(event, span)} onDoubleClick={focus}>
      {position && (instant ? <span className="tw-instant" style={{ left: `${position.left}%` }} />
        : hasChildren ? painted.map((part, i) => <span key={i} className="tw-bar" data-activity={part.kind} data-narrow={part.narrow || undefined}
          data-running={span.status === 'running' || undefined} style={{ left: part.left, width: part.width }} />)
        : <span className="tw-leaf-bar" data-running={span.status === 'running' || undefined} style={{ left: `${position.left}%`, width: `${position.width}%` }}>
          {segments.map((segment, i) => {
            const part = intervalPosition(axis, window, segment.start, segment.end)
            return part && <span key={i} className="tw-leaf-segment" data-activity={segment.kind}
              style={{ left: `${position.width ? (part.left - position.left) / position.width * 100 : 0}%`, width: `${position.width ? part.width / position.width * 100 : 100}%` }} />
          })}
        </span>)}
      {position && !instant && <span className="tw-bar-duration" style={{ left: `calc(${Math.min(100, position.left + position.width)}% + ${hasChildren ? 0 : Math.max(0, 6 - position.width * trackWidth / 100)}px)` }}>
        {spanDuration}{hasChildren && tokens !== null ? ` · ${compactTokens(tokens)} tok` : ''}</span>}
    </button>
  </div>
}

export function Overview({ model, axis, window, change, reset, t, now }: {
  model: TraceModel; axis: TimeAxis; window: TimeWindow; change: (value: TimeWindow) => void; reset: () => void; t: TraceTranslate; now: number;
}) {
  const drag = useRef<{ start: number; x: number } | null>(null)
  const lanes = ['inputLane', 'modelLane', 'toolLane'] as const
  const layers = useMemo(() => overviewRuns(model).map(run => ({ run, path: run.running ? null : overviewPath(run, axis, 0) })), [model, axis])
  return <div className="tw-overview"><div className="tw-overview-labels">{lanes.map(lane => <span key={lane}>{t(lane)}</span>)}</div>
    <div className="tw-overview-track" role="group" aria-label={t('overview')} tabIndex={0} title={t('overviewHint')}
      onDoubleClick={reset} onKeyDown={event => { if (event.key === 'Escape' || event.key === 'Home') reset() }}
      onPointerDown={event => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture?.(event.pointerId)
        const rect = event.currentTarget.getBoundingClientRect()
        drag.current = { start: Math.max(0, Math.min(axis.length, (event.clientX - rect.left) / rect.width * axis.length)), x: event.clientX }
      }}
      onPointerMove={event => {
        if (!drag.current || Math.abs(event.clientX - drag.current.x) < 3) return
        const rect = event.currentTarget.getBoundingClientRect()
        const end = Math.max(0, Math.min(axis.length, (event.clientX - rect.left) / rect.width * axis.length))
        change({ from: Math.min(drag.current.start, end), to: Math.max(drag.current.start, end) })
      }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
      <svg viewBox="0 0 1000 36" preserveAspectRatio="none" aria-hidden="true">
        {[12, 24].map(y => <path key={y} d={`M0 ${y}H1000`} className="tw-overview-rule" />)}
        {layers.map(({ run, path }, index) => <path key={index} d={path ?? overviewPath(run, axis, now)} data-activity={run.kind} />)}
      </svg>
      <div className="tw-overview-shade" style={{ width: `${window.from / axis.length * 100}%` }} />
      <div className="tw-overview-shade" style={{ left: `${window.to / axis.length * 100}%`, right: 0 }} />
      <div className="tw-overview-window" style={{ left: `${window.from / axis.length * 100}%`, width: `${(window.to - window.from) / axis.length * 100}%` }}><i /><i /></div>
    </div>
    <button className="tw-overview-reset" title={t('fit')} aria-label={t('fit')} onClick={reset}><TraceIcon name="fit" /></button>
  </div>
}

export function Handoffs({ rows, axis, window, start, end }: { rows: readonly TraceRow[]; axis: TimeAxis; window: TimeWindow; start: number; end: number }) {
  const indexes = useMemo(() => new Map(rows.map((row, index) => [row.span.id, index])), [rows])
  return <div className="tw-handoffs"><svg width="100%" height={rows.length * ROW_HEIGHT} viewBox={`0 0 100 ${rows.length * ROW_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
    {rows.slice(start, end).map(({ span }, offset) => {
      const parent = span.parentId ? indexes.get(span.parentId) : undefined
      if (!span.nested || parent === undefined) return null
      const position = intervalPosition(axis, window, span.start ?? span.anchor, span.start ?? span.anchor)
      if (!position) return null
      const y = (start + offset) * ROW_HEIGHT + ROW_HEIGHT / 2
      return <path key={span.id} d={`M${position.left} ${parent * ROW_HEIGHT + ROW_HEIGHT / 2}V${y - 5}Q${position.left} ${y} ${position.left + .8} ${y}H${position.left + 1.2}`} />
    })}
  </svg></div>
}
