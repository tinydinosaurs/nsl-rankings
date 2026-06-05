import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the api module before importing the page.
vi.mock('../../utils/api.js', () => ({
	default: {
		post: vi.fn(),
	},
}));

import api from '../../utils/api.js';
import TournamentDraftPage from './TournamentDraftPage.jsx';
import { loadDraft, clearDraft, defaultMetadata } from './draftStorage.js';

const renderPage = () =>
	render(
		<MemoryRouter>
			<TournamentDraftPage />
		</MemoryRouter>,
	);

const previewResponse = (overrides = {}) => ({
	data: {
		competitors: [
			{
				name: 'Alice Smith',
				email: 'alice@example.com',
				is_new: true,
				is_member: true,
				knockdowns_earned: 100,
				distance_earned: 90,
				speed_earned: 80,
				woods_earned: 70,
			},
		],
		warnings: [],
		...overrides,
	},
});

beforeEach(() => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	sessionStorage.clear();
	api.post.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('TournamentDraftPage', () => {
	it('persists metadata to sessionStorage after editing the name (debounced)', async () => {
		renderPage();

		const nameInput = screen.getByLabelText(/Name/i);
		fireEvent.change(nameInput, { target: { value: 'Spring Open 2026' } });

		// Before debounce window — nothing written yet.
		expect(loadDraft()).toBeNull();

		// Advance past the debounce.
		await act(async () => {
			vi.advanceTimersByTime(300);
		});

		const saved = loadDraft();
		expect(saved).not.toBeNull();
		expect(saved.metadata.name).toBe('Spring Open 2026');
		expect(saved.hadFile).toBe(false);
	});

	it('hydrates initial state from an existing draft and shows the resume prompt', () => {
		const meta = defaultMetadata();
		meta.name = 'Half-finished tournament';
		sessionStorage.setItem(
			'nsl:draft:tournament',
			JSON.stringify({ version: 1, updatedAt: 'x', metadata: meta }),
		);

		renderPage();

		expect(
			screen.getByRole('heading', { name: /Resume your draft\?/i }),
		).toBeInTheDocument();
		expect(screen.getByText(/Half-finished tournament/)).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /Resume draft/i }));

		expect(screen.getByLabelText(/Name/i)).toHaveValue(
			'Half-finished tournament',
		);
	});

	it('discarding the resume prompt clears the draft', () => {
		const meta = defaultMetadata();
		meta.name = 'Discard me';
		sessionStorage.setItem(
			'nsl:draft:tournament',
			JSON.stringify({ version: 1, updatedAt: 'x', metadata: meta }),
		);

		renderPage();
		fireEvent.click(
			screen.getByRole('button', { name: /Discard and start over/i }),
		);

		expect(loadDraft()).toBeNull();
		expect(screen.getByLabelText(/Name/i)).toHaveValue('');
	});

	it('re-runs preview when a metadata event toggle changes after a file is staged', async () => {
		api.post.mockResolvedValue(previewResponse());

		renderPage();

		const file = new File(['name,email\nAlice,alice@example.com'], 't.csv', {
			type: 'text/csv',
		});
		const fileInput = document.getElementById('results-file');
		await act(async () => {
			fireEvent.change(fileInput, { target: { files: [file] } });
			vi.advanceTimersByTime(400);
		});

		await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
		expect(api.post.mock.calls[0][0]).toBe('/upload/preview');

		// Toggle off "woods" — should re-fire preview. (There are multiple
		// "Woods" labels on the page — checkbox, points input, table header —
		// so target the checkbox specifically.)
		const woodsCheckbox = screen
			.getAllByRole('checkbox')
			.find((el) => el.closest('label')?.textContent?.includes('Woods'));
		fireEvent.click(woodsCheckbox);
		await act(async () => {
			vi.advanceTimersByTime(400);
		});

		await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
	});

	it('clears the draft and navigates after a successful commit', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview') return Promise.resolve(previewResponse());
			if (url === '/upload/commit')
				return Promise.resolve({ data: { tournament_id: 42 } });
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fireEvent.change(screen.getByLabelText(/Name/i), {
			target: { value: 'Commit Test' },
		});

		const file = new File(['name,email\nAlice,alice@example.com'], 't.csv', {
			type: 'text/csv',
		});
		const fileInput = document.getElementById('results-file');
		await act(async () => {
			fireEvent.change(fileInput, { target: { files: [file] } });
			vi.advanceTimersByTime(400);
		});

		await waitFor(() =>
			expect(screen.getByText(/competitors found/i)).toBeInTheDocument(),
		);

		// Sanity check: draft has been persisted by now.
		await act(async () => {
			vi.advanceTimersByTime(300);
		});
		expect(loadDraft()).not.toBeNull();

		const commitButton = screen.getByRole('button', {
			name: /Confirm & Save/i,
		});
		await act(async () => {
			fireEvent.click(commitButton);
		});

		await waitFor(() =>
			expect(api.post).toHaveBeenCalledWith(
				'/upload/commit',
				expect.objectContaining({
					tournament_name: 'Commit Test',
					competitors: expect.any(Array),
				}),
			),
		);

		expect(loadDraft()).toBeNull();
	});

	it('saves the tournament with no file via POST /rankings/tournaments', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/rankings/tournaments')
				return Promise.resolve({ data: { id: 7 } });
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fireEvent.change(screen.getByLabelText(/Name/i), {
			target: { value: 'No-file Tournament' },
		});

		// No file attached; button should be enabled and labeled "Save tournament".
		const saveButton = screen.getByRole('button', { name: /Save tournament/i });
		expect(saveButton).not.toBeDisabled();

		await act(async () => {
			fireEvent.click(saveButton);
		});

		await waitFor(() =>
			expect(api.post).toHaveBeenCalledWith(
				'/rankings/tournaments',
				expect.objectContaining({
					name: 'No-file Tournament',
					has_knockdowns: 1,
				}),
			),
		);
		expect(loadDraft()).toBeNull();
	});
});

describe('draftStorage', () => {
	beforeEach(() => sessionStorage.clear());

	it('clearDraft removes the entry', () => {
		sessionStorage.setItem(
			'nsl:draft:tournament',
			JSON.stringify({ version: 1, updatedAt: 'x', metadata: defaultMetadata() }),
		);
		clearDraft();
		expect(sessionStorage.getItem('nsl:draft:tournament')).toBeNull();
	});

	it('loadDraft returns null for a mismatched version', () => {
		sessionStorage.setItem(
			'nsl:draft:tournament',
			JSON.stringify({ version: 99, metadata: defaultMetadata() }),
		);
		expect(loadDraft()).toBeNull();
	});
});
