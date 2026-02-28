import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
	it('renders the provided message', () => {
		render(<EmptyState message="No competitors yet." />);
		expect(screen.getByText('No competitors yet.')).toBeInTheDocument();
	});

	it('renders different messages correctly', () => {
		const { rerender } = render(
			<EmptyState message="No tournaments found." />,
		);
		expect(screen.getByText('No tournaments found.')).toBeInTheDocument();

		rerender(<EmptyState message="No results match your search." />);
		expect(screen.getByText('No results match your search.')).toBeInTheDocument();
	});

	it('applies the card and empty-state classes', () => {
		render(<EmptyState message="Nothing here." />);
		const el = screen.getByText('Nothing here.').closest('div');
		expect(el).toHaveClass('card');
		expect(el).toHaveClass('empty-state');
	});
});
