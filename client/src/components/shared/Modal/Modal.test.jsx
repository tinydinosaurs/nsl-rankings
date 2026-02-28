import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
	describe('visibility', () => {
		it('renders nothing when isOpen is false', () => {
			render(
				<Modal isOpen={false} onClose={vi.fn()} title="Test">
					<p>Content</p>
				</Modal>,
			);
			expect(screen.queryByText('Test')).not.toBeInTheDocument();
			expect(screen.queryByText('Content')).not.toBeInTheDocument();
		});

		it('renders when isOpen is true', () => {
			render(
				<Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
					<p>Modal content</p>
				</Modal>,
			);
			expect(screen.getByText('Test Modal')).toBeInTheDocument();
			expect(screen.getByText('Modal content')).toBeInTheDocument();
		});
	});

	describe('title', () => {
		it('renders the provided title', () => {
			render(
				<Modal isOpen={true} onClose={vi.fn()} title="Add Competitor">
					<p>content</p>
				</Modal>,
			);
			expect(
				screen.getByRole('heading', { name: 'Add Competitor' }),
			).toBeInTheDocument();
		});
	});

	describe('children', () => {
		it('renders children inside the modal body', () => {
			render(
				<Modal isOpen={true} onClose={vi.fn()} title="Test">
					<button>Submit</button>
					<p>Some text</p>
				</Modal>,
			);
			expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
			expect(screen.getByText('Some text')).toBeInTheDocument();
		});
	});

	describe('closing', () => {
		it('calls onClose when the close button is clicked', async () => {
			const onClose = vi.fn();
			render(
				<Modal isOpen={true} onClose={onClose} title="Test">
					<p>content</p>
				</Modal>,
			);
			await userEvent.click(screen.getByRole('button', { name: 'Close modal' }));
			expect(onClose).toHaveBeenCalledOnce();
		});

		it('calls onClose when the overlay is clicked', async () => {
			const onClose = vi.fn();
			render(
				<Modal isOpen={true} onClose={onClose} title="Test">
					<p>content</p>
				</Modal>,
			);
			// Click the overlay (the outermost element)
			await userEvent.click(screen.getByText('content').closest('.modal-overlay'));
			expect(onClose).toHaveBeenCalledOnce();
		});

		it('does not call onClose when clicking inside the modal content', async () => {
			const onClose = vi.fn();
			render(
				<Modal isOpen={true} onClose={onClose} title="Test">
					<p>content</p>
				</Modal>,
			);
			await userEvent.click(screen.getByText('content').closest('.modal-content'));
			expect(onClose).not.toHaveBeenCalled();
		});
	});
});
