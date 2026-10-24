// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { TraceView } from '../src/client/TraceView.tsx'
import { EMPTY_TRAJECTORY_SNAPSHOT } from '../src/client/adapter/trajectory-snapshot-builder.ts'
import type { TrajectorySnapshot } from '../src/client/adapter/trajectory-contract.ts'
import { BASE, fixture, t, tool } from './fixture.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
function props(snapshot: TrajectorySnapshot = fixture(), overrides: Partial<ComponentProps<typeof TraceView>> = {}): ComponentProps<typeof TraceView> {
  const session: SessionSnapshot = { sessionId: 'fixture' as SessionId, pendingSubmissions: [], running: false,
    subagent: null, removed: false, openState: 'open', openError: null, hasMore: false, loadingOlder: false,
    promptError: null, blank: false, lastAgentError: null, promptAttempted: true, awaitingFirstTurn: false }
  return { useTrajectory: selector => selector(snapshot), useSession: selector => selector(session), t,
    loadOlder: async () => {}, viewRequest: null, completeViewRequest: vi.fn(), ...overrides }
}

describe('waterfall interactions', () => {
  it('starts live at the tail, follows appends, and respects scrolling, search and popover inspection', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(120)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return 30 + Number.parseFloat(this.querySelector<HTMLElement>('.tw-rows')?.style.height ?? '0')
    })
    const snapshot = (count: number): TrajectorySnapshot => ({ ...EMPTY_TRAJECTORY_SNAPSHOT,
      eventNodes: Array.from({ length: count }, (_, i) => tool(`done-${i}`, `done_${i}`, i * 100, i * 100 + 40)),
      runningCalls: [{ phase: 'start', callId: 'live', name: 'live_call', time: BASE + count * 100,
        turn: 1, step: 1, argsRaw: '{}', args: tool('args', 'bash', 0, 1).args, subCalls: [] }] })
    const view = render(<TraceView {...props(snapshot(80))} />)
    const pane = document.querySelector<HTMLElement>('.tw-scroll')!
    const bottom = () => pane.scrollHeight - pane.clientHeight
    expect(pane.scrollTop).toBe(bottom())
    view.rerender(<TraceView {...props(snapshot(81))} />)
    expect(pane.scrollTop).toBe(bottom())
    fireEvent.scroll(pane, { target: { scrollTop: 100 } })
    view.rerender(<TraceView {...props(snapshot(82))} />)
    expect(pane.scrollTop).toBe(100)
    fireEvent.scroll(pane, { target: { scrollTop: bottom() } })
    view.rerender(<TraceView {...props(snapshot(83))} />)
    expect(pane.scrollTop).toBe(bottom())
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect live_call' })[0]!)
    const inspectingTop = pane.scrollTop
    view.rerender(<TraceView {...props(snapshot(84))} />)
    expect(pane.scrollTop).toBe(inspectingTop)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape' })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'done' } })
    view.rerender(<TraceView {...props(snapshot(85))} />)
    expect(pane.scrollTop).toBe(0)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    view.rerender(<TraceView {...props(snapshot(86))} />)
    expect(pane.scrollTop).toBe(0)
  })

  it('keeps history at the top and freezes completed bar widths inside a live axis block', () => {
    vi.useFakeTimers(); vi.setSystemTime(BASE + 60_000)
    const history: TrajectorySnapshot = { ...EMPTY_TRAJECTORY_SNAPSHOT, eventNodes: [tool('done', 'read_file', 0, 1000)] }
    const view = render(<TraceView {...props(history)} />)
    expect(document.querySelector<HTMLElement>('.tw-scroll')!.scrollTop).toBe(0)
    const running = { ...history, runningCalls: [{ phase: 'start' as const, callId: 'live', name: 'bash', time: BASE + 1000,
      turn: 1, step: 1, argsRaw: '{}', args: tool('args', 'bash', 0, 1).args, subCalls: [] }] }
    view.rerender(<TraceView {...props(running)} />)
    const width = () => screen.getAllByRole('button', { name: 'Inspect read_file' })[0]!.closest('.tw-row')!.querySelector<HTMLElement>('.tw-leaf-bar')!.style.width
    const first = width()
    act(() => { vi.advanceTimersByTime(500) })
    expect(width()).toBe(first)
    act(() => { vi.advanceTimersByTime(15_000) })
    expect(Number.parseFloat(width())).toBeLessThan(Number.parseFloat(first))
    view.rerender(<TraceView {...props(history)} />)
    expect(width()).toBe('100%')
  })

  it('opens span content, filters nested results, and clears an empty search', () => {
    render(<TraceView {...props()} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect read_file' })[0]!)
    expect(screen.getByRole('dialog', { name: 'Span summary' }).textContent).toContain('export const answer')
    fireEvent.click(screen.getByRole('button', { name: 'Full details' }))
    const details = screen.getByRole('complementary', { name: 'Span details' })
    expect(within(details).getByText(/export const answer/)).toBeTruthy()
    fireEvent.click(within(details).getByRole('button', { name: 'Input' }))
    expect(within(details).getByText(/src\/index.ts/)).toBeTruthy()
    fireEvent.click(within(details).getByRole('button', { name: 'Close details' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'stat_file' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(document.querySelector('mark')?.textContent).toBe('stat_file')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not present' } })
    expect(screen.getByText('No matching steps')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })
  it('folds branches and exposes only the error and its ancestor when filtered', () => {
    render(<TraceView {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /Errors only/ }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Inspect search_files' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Inspect read_file' })).toBeNull()
  })
  it('honors existing tool-inspection links and supports Escape and local search shortcuts', () => {
    const input = props(fixture(), { viewRequest: { view: 'trajectory', focus: 'nested' } })
    render(<TraceView {...input} />)
    expect(screen.getByRole('complementary').textContent).toContain('stat_file')
    fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape' })
    expect(input.completeViewRequest).toHaveBeenCalledOnce()
    expect(screen.queryByRole('complementary')).toBeNull()
    fireEvent.keyDown(screen.getByRole('region'), { key: 'f', ctrlKey: true })
    expect(document.activeElement).toBe(screen.getByRole('searchbox'))
  })
  it('renders an empty state and keeps the rendered row count bounded for large histories', () => {
    const view = render(<TraceView {...props(EMPTY_TRAJECTORY_SNAPSHOT)} />)
    expect(screen.getByText('No trace yet')).toBeTruthy()
    const many = { ...EMPTY_TRAJECTORY_SNAPSHOT,
      eventNodes: Array.from({ length: 2000 }, (_, i) => tool(`call-${i}`, `tool_${i}`, i * 2, i * 2 + 1)) }
    view.rerender(<TraceView {...props(many)} />)
    expect(screen.getAllByRole('listitem').length).toBeLessThanOrEqual(80)
    fireEvent.scroll(document.querySelector('.tw-scroll')!, { target: { scrollTop: 36 * 1950 } })
    expect(screen.getAllByRole('button', { name: 'Inspect tool_1999' })).toHaveLength(2)
  })
  it('shows history-loading failures and allows a retry', async () => {
    const loadOlder = vi.fn().mockRejectedValueOnce(new Error('Disconnected')).mockResolvedValueOnce(undefined)
    const input = props(fixture(), { loadOlder })
    const original = input.useSession
    input.useSession = selector => original(snapshot => selector({ ...snapshot, hasMore: true }))
    render(<TraceView {...input} />)
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier history' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Disconnected'))
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier history' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(loadOlder).toHaveBeenCalledTimes(2)
  })
  it('reports an unavailable session history instead of silently showing an empty trace', () => {
    const input = props(EMPTY_TRAJECTORY_SNAPSHOT)
    const original = input.useSession
    input.useSession = selector => original(snapshot => selector({ ...snapshot, openState: 'error',
      openError: new RemoteError('gateway/internal', 'Could not read the recorded session', {}) }))
    const view = render(<TraceView {...input} />)
    expect(screen.getByRole('alert').textContent).toContain('Could not read the recorded session')
    view.rerender(<TraceView {...props(fixture())} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })
  it('advances live time, keeps the selected call on settlement, and releases its clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE + 5000)
    const source = fixture()
    const running = { phase: 'start' as const, callId: 'live', name: 'bash', time: BASE + 4000,
      turn: 2, step: 1, argsRaw: '{}', args: tool('x', 'x', 0, 0).args, subCalls: [] }
    const view = render(<TraceView {...props({ ...source, runningCalls: [running] })} />)
    expect(screen.getByText('Live')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect bash' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Full details' }))
    const { act } = await import('@testing-library/react')
    act(() => vi.advanceTimersByTime(1000))
    expect(within(screen.getByRole('complementary')).getByText('2s')).toBeTruthy()
    view.rerender(<TraceView {...props({ ...source, eventNodes: [...source.eventNodes, tool('live', 'bash', 4000, 5500)] })} />)
    expect(screen.queryByText('Live')).toBeNull()
    expect(within(screen.getByRole('complementary')).getByText('1.5s')).toBeTruthy()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('shows the same whole-session token total as the composer while history is paged', () => {
    const usage: TokenUsageProjection = { uncachedInputTokens: 462, cacheReadTokens: 272128, cacheWriteTokens: 100, outputTokens: 720 }
    render(<TraceView {...props(fixture(), { useProjection: (key: string) => key === 'tokenUsage' ? usage as never : undefined })} />)
    expect(screen.getByText('273.4k')).toBeTruthy()
    expect(screen.getByText('99.8% cache')).toBeTruthy()
    expect(document.querySelector('.tw-metrics [title]')?.getAttribute('title')).toContain('273,410')
  })
  it('expands a focused branch and resets the time range from the overview', () => {
    render(<TraceView {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Focus Turn 1' }))
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(1)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByRole('button', { name: 'Zoom out' }).hasAttribute('disabled')).toBe(false)
    fireEvent.doubleClick(screen.getByRole('group', { name: 'Session overview' }))
    expect(screen.getByRole('button', { name: 'Zoom out' }).hasAttribute('disabled')).toBe(true)
  })
  it('keeps run_code description in the row and opens the host numbered source renderer', () => {
    const source = fixture(), program = tool('program', 'run_code', 100, 200)
    program.call = { name: 'run_code', argsRaw: '{"code":"const answer = 42\\nreturn answer","description":"Inspect project metadata"}' }
    render(<TraceView {...props({ ...source, eventNodes: [program], requests: [] })} />)
    expect(screen.getByText('Inspect project metadata')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect run_code' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Full details' }))
    expect(document.querySelector('[data-line-numbers="true"]')?.textContent).toContain('const answer = 42')
    expect(screen.getByRole('button', { name: 'Source' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('loads durable image thumbnails through the authorized session image loader', async () => {
    const source = fixture(), call = tool('image', 'read_image', 100, 200)
    call.content = [{ type: 'image', attachment: { attachmentId: 'image-reference' as AttachmentId,
      mediaType: 'image/png', bytes: 32, width: 10, height: 10, name: 'design.png' } }]
    const loadImage = vi.fn(async () => 'blob:authorized-image')
    render(<TraceView {...props({ ...source, eventNodes: [call], requests: [] }, { loadImage })} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect read_image' })[0]!)
    await waitFor(() => expect(screen.getByRole('img', { name: 'design.png' }).getAttribute('src')).toBe('blob:authorized-image'))
    expect(loadImage).toHaveBeenCalledOnce()
  })
  it('shows new model input and keeps focused offsets identical between the card and full details', () => {
    const source = fixture(), offset = 8.5 * 3600000, location = source.eventLocations.get(1)!
    const assistant = source.eventNodes.find(node => node.kind === 'assistant')!
    if (location.kind !== 'step' || assistant.kind !== 'assistant') throw new Error('Step fixture required')
    const later = { ...assistant, seq: 9001, turn: 2, time: BASE + offset + 2000,
      timing: { stepStartTime: BASE + offset + 100, firstTokenTime: BASE + offset + 400, completedTime: BASE + offset + 2000 } }
    const prompt = { config: { provider: 'deepseek', model: 'deepseek-flash' }, system: 'Complete system instructions', tools: [] }
    const snapshot: TrajectorySnapshot = { ...source, eventNodes: [...source.eventNodes,
      { kind: 'user', seq: 8999, time: BASE + offset, content: [{ type: 'text', text: 'Verify the follow-up change' }], source: null }, later],
      eventLocations: new Map([...source.eventLocations, [8999, { ...location, turn: { ...location.turn, turn: 2 }, step: { ...location.step, turn: 2 } }]]),
      requests: [...source.requests, { purpose: 'assistant', turn: 2, step: 1, startSeq: 9000, startedAt: BASE + offset + 100,
        completedAt: BASE + offset + 2000, status: 'complete', prompt }] }
    render(<TraceView {...props(snapshot)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Focus Turn 2' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect Model request' })[0]!)
    const card = screen.getByRole('dialog')
    expect(card.textContent).toContain('New input')
    expect(card.textContent).toContain('Verify the follow-up change')
    expect(card.textContent).not.toContain('Complete system instructions')
    expect(card.textContent).not.toContain('config')
    expect(within(card).getByText('1.9s')).toBeTruthy()
    expect(within(card).getByText('+100ms')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Full details' }))
    const details = screen.getByRole('complementary')
    expect(within(details).getByText('1.9s')).toBeTruthy()
    expect(within(details).getByText('+100ms')).toBeTruthy()
    expect(within(details).getByText('300ms')).toBeTruthy()
    fireEvent.click(within(details).getByRole('button', { name: 'Input' }))
    expect(details.textContent).toContain('Complete system instructions')
    expect(details.textContent).toContain('Verify the follow-up change')
    expect(details.textContent).toContain('deepseek-flash')
  })
})
