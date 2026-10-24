/** DSH plugin registration; components only receive renderer-bound hooks and actions. */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { registerTrajectoryAssistantDefinition } from './adapter/trajectory-assistant-definition.ts'
import { registerTrajectoryCompactionDefinitions } from './adapter/trajectory-compaction-definition.ts'
import { registerTrajectoryMessageDefinitions } from './adapter/trajectory-message-definitions.ts'
import { registerTrajectoryRequestHeaderDefinition } from './adapter/trajectory-request-header-definition.ts'
import { registerTrajectoryToolDefinition } from './adapter/trajectory-tool-definition.ts'
import { EMPTY_TRAJECTORY_SNAPSHOT, registerTrajectoryConversationView } from './adapter/trajectory-snapshot-builder.ts'
import type { TrajectorySnapshot } from './adapter/trajectory-contract.ts'
import { en, zh, NS } from './locales.ts'
import { TraceView, type TraceInjected } from './TraceView.tsx'

export const inject = ['slots', 'sessions', 'uiSession', 'uiConversation', 'locale']

/** Register one replacement for the trajectory view, with effect-scoped disposal. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'trace-waterfall: dictionaries')
  const sources = new WeakMap<SessionBinding, ObservableSnapshot<TrajectorySnapshot>>()
  registerTrajectoryMessageDefinitions(ctx)
  registerTrajectoryRequestHeaderDefinition(ctx)
  registerTrajectoryAssistantDefinition(ctx)
  registerTrajectoryToolDefinition(ctx)
  registerTrajectoryCompactionDefinitions(ctx)
  registerTrajectoryConversationView(ctx)
  ctx.uiSession.provide({
    hooks: ['trajectory'],
    resolve(binding) {
      let source = sources.get(binding)
      if (!source) {
        const target = ctx.uiConversation.binding(binding).target('trajectory')
        source = { getSnapshot: () => target.getSnapshot() ?? EMPTY_TRAJECTORY_SNAPSHOT,
          subscribe: listener => target.subscribe(listener) }
        sources.set(binding, source)
      }
      return { hooks: { trajectory: source } }
    },
  })
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'trajectory', order: 10, locale: NS,
    label: () => t('title'),
    inject: (sessionId: SessionId): TraceInjected => ({
      loadImage: Object.assign((attachment: ImageAttachmentRef) => ctx.uiConversation.imageUrl(sessionId, attachment),
        { peek: (attachment: ImageAttachmentRef) => ctx.uiConversation.peekImageUrl(sessionId, attachment) }),
      loadOlder: async () => {
        const session = ctx.sessions.binding(sessionId)?.session
        if (!session) throw new Error('Session is no longer available')
        await session.loadOlder()
      },
    }),
  }, TraceView))
}
