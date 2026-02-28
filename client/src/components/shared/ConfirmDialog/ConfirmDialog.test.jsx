import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
	describe('visibility', () => {
		it('renders nothing when isOpen is false', () => {
			render(
				<ConfirmDialog
					isOpen={false}
					onConfirm={vi.fn()}
					onCancel={vi.fn()}
					message="Are you sure?"
				/>,
			);
			expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
		});

		it('renders when isOpen is true', () => {
			render(
				<ConfirmDialog
					isOpen={true}
					onConfirm={vi.fn()}
					onCancel={vi.fn()}
					message="This will delete the record."
				/>,
			);
			expect(screen.getByText('This will delete the record.')).toBeInTheDocument();
		});
	});

	describe('title', () => {
		it('shows the default title when none is provided', () => {
			render(
				<ConfirmDialog
					isOpen={true}
					onConfirm={vi.fn()}
					onCancel={vi.fn()}
					message="Confirm?"
				/>,
			);
			expect(screen.getByRole('heading', { name: 'Are you sure?' })).toBeInTheDocument();
		});

		it('shows a custom title when provided', () => {
			render(
				<ConfirmDialog
					isOpen={true}
					onConfirm={vi.fn()}
					onCancel={vi.fn()}
					title="Delete Competitor"
					message="Confirm?"
				/>,
			);
			expect(screen.getByRole('heading', { name: 'Delete Competitor' })).toBeInTheDocument();
		});
	});

	describe('confirm button', () => {
		it('shows "Confirm" label by default', () => {
			render(
				<ConfirmDialog
					isOpen={true}
					onConfirm={vi.fn()}
					onCancel={vi.fn()}
					message="Sure?"
				/>,
			);
			expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
		});

		it('shows a custom confirm label when provided', () => {
			render(
				<ConfirmDialog
					isOpen={true}
					onConfirm={vi.fn()}
					onCancel={vi.fn()}
					message="Sure?"
					confirmLabel="Delete"
				/>,
			);
			expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
		});

		it('calls onConfirm when the confirm button is clicked', async () => {
			const onConfirm = vi.fn();
			render(
				<ConfirmDialog
					isOpen={true}
					onConfirm={onConfirm}
					onCancel={vi.fn()}
					message="Sure?"
					confirmLabel="Delete"
				/>,
			);
			await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
			expect(onConfirm).toHaveBeenCalledOnce();
		});
	});

	describe('cancelling', () => {
		it('calls onCancel when the Cancel button is clicked', async () => {
			const onCancel = vi.fn();
			render(
				<ConfirmDialog
					isOpen={true}
					onConfirm={vi.fn()}
					onCancel={onCancel}
					message="Sure?"
				/>,
			);
			await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
			expect(onCancel).toHaveBeenCalledOnce();
		});

		it('calls onCancel when the modal close button is clicked', async () => {
			const onCancel = vi.fn();
			render(
				<ConfirmDialog
					isOpen={true}
					onConfirm={vi.fn()}
					onCancel={onCancel}
					message="Sure?"
				/>,
			);
			await userEvent.click(screen.getByRole('button', { name: 'Close modal' }));
			expect(onCancel).toHaveBeenCalledOnce();
		});
	});
});
