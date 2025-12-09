import type { Message, MessageRepository } from '../db/MessageRepository.js'
import type { Output, OutputRepository } from '../db/OutputRepository.js'

/**
 * History data for a session including messages and outputs.
 */
export interface SessionHistory {
	messages: Message[]
	outputs: Output[]
}

/**
 * Get the full history for a session.
 *
 * @param sessionId - The session ID to get history for
 * @param messageRepo - The message repository
 * @param outputRepo - The output repository
 * @returns Session history with messages and outputs
 */
export function getSessionHistory(
	sessionId: string,
	messageRepo: MessageRepository,
	outputRepo: OutputRepository,
): SessionHistory {
	const messages = messageRepo.findBySessionId(sessionId)
	const outputs = outputRepo.findBySessionId(sessionId)

	return {
		messages,
		outputs,
	}
}
