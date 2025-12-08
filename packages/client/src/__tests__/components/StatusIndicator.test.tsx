import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusIndicator } from '../../components/Common/StatusIndicator.js'

describe('StatusIndicator', () => {
	it('should render idle status with gray color', () => {
		render(<StatusIndicator status="idle" />)

		const indicator = screen.getByRole('status')
		expect(indicator).toHaveClass('bg-gray-500')
		expect(indicator).toHaveAttribute('aria-label', 'Session idle')
	})

	it('should render running status with green color and pulse', () => {
		render(<StatusIndicator status="running" />)

		const indicator = screen.getByRole('status')
		expect(indicator).toHaveClass('bg-green-500')
		expect(indicator).toHaveClass('animate-pulse')
		expect(indicator).toHaveAttribute('aria-label', 'Session running')
	})

	it('should render error status with red color', () => {
		render(<StatusIndicator status="error" />)

		const indicator = screen.getByRole('status')
		expect(indicator).toHaveClass('bg-red-500')
		expect(indicator).toHaveAttribute('aria-label', 'Session error')
	})
})
