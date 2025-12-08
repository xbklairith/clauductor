import { create } from 'zustand'

export interface ConnectionState {
	isConnected: boolean
	isReconnecting: boolean
	setConnected: (connected: boolean) => void
	setReconnecting: (reconnecting: boolean) => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
	isConnected: false,
	isReconnecting: false,
	setConnected: (isConnected) => set({ isConnected, isReconnecting: false }),
	setReconnecting: (isReconnecting) => set({ isReconnecting }),
}))
