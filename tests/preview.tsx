/** Browser-only visual fixture; production always mounts through DSH slots. */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { TraceView } from '../src/client/TraceView.tsx'
import { fixture, t, tool, BASE } from './fixture.ts'
import type { SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

const source = fixture()
const program = tool('program', 'run_code', 3650, 5900)
program.call = { name: 'run_code', argsRaw: JSON.stringify({ description: 'Inspect project metadata',
  code: 'const project = await tools.read_file({ path: "package.json" })\nconst manifest = JSON.parse(project)\nconsole.log(manifest.name)\nreturn { name: manifest.name, scripts: manifest.scripts }' }) }
const extra = [program, tool('diff', 'git_diff', 3650, 4350)]
const records = { ...source, eventNodes: [...source.eventNodes, ...extra],
  callSchemas: new Map([['program', { name: 'run_code', description: 'Execute a program', parameters: { type: 'object', properties: { code: { type: 'string', description: 'TypeScript source code' } } } }]]),
  requests: [...source.requests, { purpose: 'assistant' as const, startSeq: 6000, turn: 1, step: 2,
    startedAt: BASE + 6000, completedAt: BASE + 8400, status: 'complete' as const,
    providerMetadata: { provider: 'deepseek', model: 'deepseek-chat' }, usage: { inputTokens: 1840, outputTokens: 372 } }],
  eventLocations: new Map([...source.eventLocations, ...extra.map(call => [call.seq, source.eventLocations.get(3500)!] as const)]),
}
const session: SessionSnapshot = { sessionId: 'preview' as SessionId, pendingSubmissions: [], running: false,
  subagent: null, removed: false, openState: 'open', openError: null, hasMore: false, loadingOlder: false,
  promptError: null, blank: false, lastAgentError: null, promptAttempted: true, awaitingFirstTurn: false }
function Preview() {
  const [request, setRequest] = useState<ComponentProps<typeof TraceView>['viewRequest']>(null)
  return <TraceView useTrajectory={selector => selector(records)} useSession={selector => selector(session)}
    t={t} viewRequest={request} completeViewRequest={() => setRequest(null)} loadOlder={async () => {}} />
}
createRoot(document.getElementById('root')!).render(<Preview />)
