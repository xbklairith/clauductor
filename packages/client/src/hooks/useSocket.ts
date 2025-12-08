import { useEffect } from 'react'
import { socket, connectSocket, disconnectSocket } from '../lib/socket.js'
import { useConnectionStore } from '../stores/connectionStore.js'
import { useSessionStore } from '../stores/sessionStore.js'

export function useSocket(): void {
	const setConnected = useConnectionStore((state) => state.setConnected)
	const setReconnecting = useConnectionStore((state) => state.setReconnecting)

	const setSessions = useSessionStore((state) => state.setSessions)
	const addSession = useSessionStore((state) => state.addSession)
	const removeSession = useSessionStore((state) => state.removeSession)
	const setActiveSession = useSessionStore((state) => state.setActiveSession)
	const updateSessionStatus = useSessionStore((state) => state.updateSessionStatus)
	const appendOutput = useSessionStore((state) => state.appendOutput)
	const setLoading = useSessionStore((state) => state.setLoading)

	useEffect(() => {
		// Connection events
		const handleConnect = () => {
			setConnected(true)
		}

		const handleDisconnect = () => {
			setConnected(false)
		}

		const handleReconnectAttempt = () => {
			setReconnecting(true)
		}

		// Session events
		const handleSessionList = (sessions: Parameters<typeof setSessions>[0]) => {
			setSessions(sessions)
		}

		const handleSessionCreated = (session: Parameters<typeof addSession>[0]) => {
			addSession(session)
			setActiveSession(session.id)
			setLoading(false)
		}

		const handleSessionOutput = (output: Parameters<typeof appendOutput>[1]) => {
			appendOutput(output.sessionId, output)
		}

		const handleSessionStatus = ({
			sessionId,
			status,
		}: {
			sessionId: string
			status: Parameters<typeof updateSessionStatus>[1]
		}) => {
			updateSessionStatus(sessionId, status)
		}

		const handleSessionDestroyed = ({ sessionId }: { sessionId: string }) => {
			removeSession(sessionId)
		}

		// Subscribe to events
		socket.on('connect', handleConnect)
		socket.on('disconnect', handleDisconnect)
		socket.io.on('reconnect_attempt', handleReconnectAttempt)
		socket.on('session:list', handleSessionList)
		socket.on('session:created', handleSessionCreated)
		socket.on('session:output', handleSessionOutput)
		socket.on('session:status', handleSessionStatus)
		socket.on('session:destroyed', handleSessionDestroyed)

		// Connect
		connectSocket()

		// Cleanup
		return () => {
			socket.off('connect', handleConnect)
			socket.off('disconnect', handleDisconnect)
			socket.io.off('reconnect_attempt', handleReconnectAttempt)
			socket.off('session:list', handleSessionList)
			socket.off('session:created', handleSessionCreated)
			socket.off('session:output', handleSessionOutput)
			socket.off('session:status', handleSessionStatus)
			socket.off('session:destroyed', handleSessionDestroyed)
			disconnectSocket()
		}
	}, [
		setConnected,
		setReconnecting,
		setSessions,
		addSession,
		removeSession,
		setActiveSession,
		updateSessionStatus,
		appendOutput,
		setLoading,
	])
}
