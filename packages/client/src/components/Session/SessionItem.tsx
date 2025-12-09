import type { Session } from '@clauductor/shared'
import { StatusIndicator } from '../Common/StatusIndicator.js'

interface SessionItemProps {
	session: Session
	isActive: boolean
	onClick: () => void
}

export function SessionItem({ session, isActive, onClick }: SessionItemProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			data-testid="session-item"
			className={`
				w-full p-3 text-left flex items-center gap-2
				transition-colors cursor-pointer
				${isActive ? 'bg-gray-700' : 'hover:bg-gray-800'}
			`}
		>
			<StatusIndicator status={session.status} />
			<span className="truncate flex-1">{session.name}</span>
		</button>
	)
}
