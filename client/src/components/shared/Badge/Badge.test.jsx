import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Badge from './Badge';

describe('Badge', () => {
	describe('rendering', () => {
		it('renders the provided text', () => {
			render(<Badge text="Hello" variant="success" />);
			expect(screen.getByText('Hello')).toBeInTheDocument();
		});

		it('renders with no variant gracefully', () => {
			render(<Badge text="No Variant" />);
			expect(screen.getByText('No Variant')).toBeInTheDocument();
		});
	});

	describe('variants', () => {
		it('applies success variant class', () => {
			render(<Badge text="Email Verified" variant="success" />);
			expect(screen.getByText('Email Verified')).toHaveClass(
				'badge-success',
			);
		});

		it('applies warning variant class', () => {
			render(<Badge text="Placeholder Email" variant="warning" />);
			expect(screen.getByText('Placeholder Email')).toHaveClass(
				'badge-warning',
			);
		});

		it('applies info variant class', () => {
			render(<Badge text="Owner" variant="info" />);
			expect(screen.getByText('Owner')).toHaveClass('badge-info');
		});

		it('applies neutral variant class', () => {
			render(<Badge text="Inactive" variant="neutral" />);
			expect(screen.getByText('Inactive')).toHaveClass('badge-neutral');
		});
	});

	describe('real usage - email status', () => {
		it('renders correctly as a placeholder email badge', () => {
			render(<Badge text="Placeholder Email" variant="warning" />);
			const badge = screen.getByText('Placeholder Email');
			expect(badge).toBeInTheDocument();
			expect(badge).toHaveClass('badge');
			expect(badge).toHaveClass('badge-warning');
		});

		it('renders correctly as a verified email badge', () => {
			render(<Badge text="Email Verified" variant="success" />);
			const badge = screen.getByText('Email Verified');
			expect(badge).toBeInTheDocument();
			expect(badge).toHaveClass('badge');
			expect(badge).toHaveClass('badge-success');
		});
	});
});
