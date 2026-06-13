import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Checkbox from './Checkbox';

describe('Checkbox', () => {
	describe('rendering', () => {
		it('renders the label text', () => {
			render(
				<Checkbox label="NSL member" checked={false} onChange={() => {}} />,
			);
			expect(screen.getByText('NSL member')).toBeInTheDocument();
		});

		it('renders an unchecked checkbox by default props', () => {
			render(<Checkbox label="x" checked={false} onChange={() => {}} />);
			expect(screen.getByRole('checkbox')).not.toBeChecked();
		});

		it('renders a checked checkbox when checked is true', () => {
			render(<Checkbox label="x" checked={true} onChange={() => {}} />);
			expect(screen.getByRole('checkbox')).toBeChecked();
		});

		it('renders the description when provided', () => {
			render(
				<Checkbox
					label="x"
					description="Only members appear on the public leaderboard."
					checked={false}
					onChange={() => {}}
				/>,
			);
			expect(
				screen.getByText('Only members appear on the public leaderboard.'),
			).toBeInTheDocument();
		});

		it('does not render a description when not provided', () => {
			const { container } = render(
				<Checkbox label="x" checked={false} onChange={() => {}} />,
			);
			expect(container.querySelector('.checkbox-description')).toBeNull();
		});
	});

	describe('interaction', () => {
		it('calls onChange when clicked', async () => {
			const handleChange = vi.fn();
			render(<Checkbox label="x" checked={false} onChange={handleChange} />);
			await userEvent.click(screen.getByRole('checkbox'));
			expect(handleChange).toHaveBeenCalledTimes(1);
		});

		it('calls onChange when the label text is clicked', async () => {
			const handleChange = vi.fn();
			render(
				<Checkbox label="Toggle me" checked={false} onChange={handleChange} />,
			);
			await userEvent.click(screen.getByText('Toggle me'));
			expect(handleChange).toHaveBeenCalledTimes(1);
		});

		it('does not call onChange when disabled', async () => {
			const handleChange = vi.fn();
			render(
				<Checkbox label="x" checked={false} onChange={handleChange} disabled />,
			);
			await userEvent.click(screen.getByRole('checkbox'));
			expect(handleChange).not.toHaveBeenCalled();
		});
	});

	describe('accessibility', () => {
		it('associates the label with the input via htmlFor/id', () => {
			render(
				<Checkbox label="Accessible" checked={false} onChange={() => {}} />,
			);
			// getByLabelText proves the label is wired to the input correctly.
			expect(screen.getByLabelText('Accessible')).toBe(
				screen.getByRole('checkbox'),
			);
		});

		it('uses an explicit id when provided', () => {
			render(
				<Checkbox id="my-id" label="x" checked={false} onChange={() => {}} />,
			);
			expect(screen.getByRole('checkbox')).toHaveAttribute('id', 'my-id');
		});

		it('passes through the name attribute', () => {
			render(
				<Checkbox
					name="is_member"
					label="x"
					checked={false}
					onChange={() => {}}
				/>,
			);
			expect(screen.getByRole('checkbox')).toHaveAttribute('name', 'is_member');
		});

		it('marks the input as disabled when the prop is true', () => {
			render(
				<Checkbox label="x" checked={false} onChange={() => {}} disabled />,
			);
			expect(screen.getByRole('checkbox')).toBeDisabled();
		});
	});
});
