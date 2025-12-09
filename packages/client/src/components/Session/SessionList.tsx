import type { Session } from '@clauductor/shared'
import { useSessionStore } from '../../stores/sessionStore.js'
import { SessionItem } from './SessionItem.js'

export function SessionList() {
	const sessions = useSessionStore((state) => state.sessions)
	const activeSessionId = useSessionStore((state) => state.activeSessionId)
	const setActiveSession = useSessionStore((state) => state.setActiveSession)

	if (sessions.length === 0) {
		return (
			<div
				className="flex-1 flex items-center justify-center p-4 text-gray-500 text-sm"
				data-testid="session-list-empty"
			>
				No sessions yet
			</div>
		)
	}

	return (
		<div className="flex-1 overflow-y-auto" data-testid="session-list">
			{sessions.map((session: Session) => (
				<SessionItem
					key={session.id}
					session={session}
					isActive={session.id === activeSessionId}
					onClick={() => setActiveSession(session.id)}
				/>
			))}
		</div>
	)
}
