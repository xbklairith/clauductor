import type { Session } from '@clauductor/shared'

// Placeholder component - will be implemented in frontend-core feature
export default function App() {
	// Type check: ensure Session type is imported correctly
	const _sessionTypeCheck: Session['status'] = 'idle'
	void _sessionTypeCheck

	return (
		<div className="flex h-screen items-center justify-center">
			<h1 className="text-2xl font-bold">Clauductor</h1>
		</div>
	)
}
