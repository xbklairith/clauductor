import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionItem } from '../../components/Session/SessionItem.js'
import type { Session } from '@clauductor/shared'

describe('SessionItem', () => {
	const mockSession: Session = {
		id: '1',
		name: 'Test Session',
		status: 'idle',
		workingDir: '/tmp',
		createdAt: '2025-01-01',
		updatedAt: '2025-01-01',
	}

	it('should render session name', () => {
		render(<SessionItem session={mockSession} isActive={false} onClick={() => {}} />)

		expect(screen.getByText('Test Session')).toBeInTheDocument()
	})

	it('should show status indicator', () => {
		render(<SessionItem session={mockSession} isActive={false} onClick={() => {}} />)

		expect(screen.getByRole('status')).toBeInTheDocument()
	})

	it('should call onClick when clicked', () => {
		const onClick = vi.fn()
		render(<SessionItem session={mockSession} isActive={false} onClick={onClick} />)

		fireEvent.click(screen.getByRole('button'))

		expect(onClick).toHaveBeenCalledOnce()
	})

	it('should have active styling when isActive', () => {
		render(<SessionItem session={mockSession} isActive={true} onClick={() => {}} />)

		const button = screen.getByRole('button')
		expect(button).toHaveClass('bg-gray-700')
	})

	it('should have hover styling when not active', () => {
		render(<SessionItem session={mockSession} isActive={false} onClick={() => {}} />)

		const button = screen.getByRole('button')
		expect(button).toHaveClass('hover:bg-gray-800')
	})
})
