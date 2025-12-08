import type { Session } from '@clauductor/shared'

interface StatusIndicatorProps {
	status: Session['status']
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
	const baseClasses = 'w-2 h-2 rounded-full'

	const statusClasses = {
		idle: 'bg-gray-500',
		running: 'bg-green-500 animate-pulse',
		error: 'bg-red-500',
	}

	const ariaLabels = {
		idle: 'Session idle',
		running: 'Session running',
		error: 'Session error',
	}

	return (
		<span
			className={`${baseClasses} ${statusClasses[status]}`}
			aria-label={ariaLabels[status]}
			role="status"
		/>
	)
}
