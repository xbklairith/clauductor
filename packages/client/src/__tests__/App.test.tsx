import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('App', () => {
	it('should render Clauductor heading', () => {
		render(<App />)
		expect(screen.getByText('Clauductor')).toBeInTheDocument()
	})
})
