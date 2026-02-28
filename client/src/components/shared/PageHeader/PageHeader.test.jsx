import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
	describe('title', () => {
		it('renders the title', () => {
			render(<PageHeader title="Competitors" />);
			expect(screen.getByRole('heading', { name: 'Competitors' })).toBeInTheDocument();
		});
	});

	describe('subtitle', () => {
		it('renders the subtitle when provided', () => {
			render(<PageHeader title="Competitors" subtitle="48 competitors" />);
			expect(screen.getByText('48 competitors')).toBeInTheDocument();
		});

		it('does not render a subtitle when omitted', () => {
			render(<PageHeader title="Competitors" />);
		expect(document.querySelector('.page-subtitle')).not.toBeInTheDocument();
		});
	});

	describe('action', () => {
		it('renders the action slot when provided', () => {
			render(
				<PageHeader
					title="Competitors"
					action={<button>Add Competitor</button>}
				/>,
			);
			expect(screen.getByRole('button', { name: 'Add Competitor' })).toBeInTheDocument();
		});

		it('does not render an action slot when omitted', () => {
			render(<PageHeader title="Competitors" />);
			expect(screen.queryByRole('button')).not.toBeInTheDocument();
		});
	});
});
