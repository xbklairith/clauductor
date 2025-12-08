import { useSessionStore } from '../../stores/sessionStore.js'
import { ConnectionBanner } from '../Common/index.js'
import { Terminal } from '../Terminal/index.js'
import { MessageInput } from '../Input/index.js'
import { Sidebar } from './Sidebar.js'

export function MainLayout() {
	const activeSessionId = useSessionStore((state) => state.activeSessionId)

	return (
		<div className="flex h-screen bg-gray-900 text-white">
			<Sidebar />
			<main className="flex-1 flex flex-col">
				<ConnectionBanner />
				<Terminal sessionId={activeSessionId} />
				<MessageInput />
			</main>
		</div>
	)
}
