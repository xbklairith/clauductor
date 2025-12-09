import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@clauductor/shared'

// Use env variable or default to current origin (works with any port)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001')

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
	autoConnect: false,
	reconnection: true,
	reconnectionAttempts: Number.POSITIVE_INFINITY,
	reconnectionDelay: 1000,
	reconnectionDelayMax: 5000,
})

export function connectSocket(): void {
	if (!socket.connected) {
		socket.connect()
	}
}

export function disconnectSocket(): void {
	socket.disconnect()
}
