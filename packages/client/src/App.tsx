import { useSocket } from './hooks/useSocket.js'
import { MainLayout } from './components/Layout/index.js'

export default function App() {
	// Initialize socket connection and wire up events
	useSocket()

	return <MainLayout />
}
