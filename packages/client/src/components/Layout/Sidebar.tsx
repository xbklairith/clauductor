import { SessionList, NewSessionButton } from '../Session/index.js'

export function Sidebar() {
	return (
		<aside className="w-64 border-r border-gray-700 flex flex-col bg-gray-900">
			<div className="p-4 border-b border-gray-700">
				<NewSessionButton />
			</div>
			<SessionList />
		</aside>
	)
}
