import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	render,
	screen,
	fireEvent,
	waitFor,
	act,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the api module before importing the page.
vi.mock('../../utils/api.js', () => ({
	default: {
		post: vi.fn(),
		get: vi.fn(),
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
	api.get.mockReset();
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
			JSON.stringify({
				version: 1,
				updatedAt: 'x',
				metadata: defaultMetadata(),
			}),
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

describe('TournamentDraftPage — update mode', () => {
	const seededMeta = {
		name: 'Spring Open 2026',
		date: '2026-04-12',
		events: {
			has_knockdowns: true,
			has_distance: true,
			has_speed: false,
			has_woods: true,
		},
		points: {
			total_points_knockdowns: 100,
			total_points_distance: 120,
			total_points_speed: 120,
			total_points_woods: 80,
		},
	};

	const renderUpdate = () =>
		render(
			<MemoryRouter>
				<TournamentDraftPage
					mode="update"
					tournamentId={42}
					initialMetadata={seededMeta}
					pageTitle="Add results to Spring Open 2026"
					pageSubtitle="..."
					cancelTo="/admin/tournaments/42"
				/>
			</MemoryRouter>,
		);

	it('hydrates from initialMetadata and does not touch sessionStorage', async () => {
		renderUpdate();
		expect(screen.getByLabelText(/Name/i)).toHaveValue('Spring Open 2026');
		expect(screen.getByLabelText(/Date/i)).toHaveValue('2026-04-12');

		// Edit something to confirm we still don't write to sessionStorage.
		fireEvent.change(screen.getByLabelText(/Name/i), {
			target: { value: 'Renamed' },
		});
		await act(async () => {
			vi.advanceTimersByTime(500);
		});
		expect(sessionStorage.getItem('nsl:draft:tournament')).toBeNull();
	});

	it('disables Commit until a file is staged', () => {
		renderUpdate();
		const commit = screen.getByRole('button', {
			name: /Choose a file to add results/i,
		});
		expect(commit).toBeDisabled();
	});

	it('commits with tournament_id and edited metadata', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview') return Promise.resolve(previewResponse());
			if (url === '/upload/commit')
				return Promise.resolve({ data: { tournament_id: 42 } });
			throw new Error(`unexpected url ${url}`);
		});

		renderUpdate();

		// Tweak the name inline.
		fireEvent.change(screen.getByLabelText(/Name/i), {
			target: { value: 'Spring Open 2026 (revised)' },
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

		const commit = screen.getByRole('button', { name: /Confirm & Save/i });
		await act(async () => {
			fireEvent.click(commit);
		});

		await waitFor(() =>
			expect(api.post).toHaveBeenCalledWith(
				'/upload/commit',
				expect.objectContaining({
					tournament_id: 42,
					tournament_name: 'Spring Open 2026 (revised)',
					competitors: expect.any(Array),
				}),
			),
		);
	});

	it('never falls back to POST /rankings/tournaments in update mode', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview') return Promise.resolve(previewResponse());
			if (url === '/upload/commit')
				return Promise.resolve({ data: { tournament_id: 42 } });
			throw new Error(`unexpected url ${url}`);
		});

		renderUpdate();

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

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));
		});

		await waitFor(() => {
			const urls = api.post.mock.calls.map(([url]) => url);
			expect(urls).not.toContain('/rankings/tournaments');
		});
	});
});

describe('TournamentDraftPage — slice 5 confirmations', () => {
	const stageFile = async () => {
		const file = new File(['name,email\nAlice,alice@example.com'], 't.csv', {
			type: 'text/csv',
		});
		const fileInput = document.getElementById('results-file');
		await act(async () => {
			fireEvent.change(fileInput, { target: { files: [file] } });
			vi.advanceTimersByTime(400);
		});
	};

	const fillCreateMetadata = () => {
		fireEvent.change(screen.getByLabelText(/Name/i), {
			target: { value: 'Some Tournament' },
		});
		fireEvent.change(screen.getByLabelText(/Date/i), {
			target: { value: '2026-04-12' },
		});
	};

	it('renders the membership-flip callout when the preview contains flips', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview')
				return Promise.resolve(
					previewResponse({
						membership_changes: [
							{
								name: 'Alice Smith',
								email: 'alice@example.com',
								before: false,
								after: true,
							},
						],
					}),
				);
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fillCreateMetadata();
		await stageFile();

		await waitFor(() =>
			expect(screen.getByTestId('membership-flip-callout')).toBeInTheDocument(),
		);
		expect(screen.getByText(/Non-member → Member/i)).toBeInTheDocument();
	});

	it('renders the missing-event banner when active events have no column', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview')
				return Promise.resolve(
					previewResponse({ missing_event_columns: ['woods'] }),
				);
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fillCreateMetadata();
		await stageFile();

		await waitFor(() =>
			expect(screen.getByTestId('missing-event-banner')).toBeInTheDocument(),
		);
		expect(
			screen.getByRole('button', { name: /Edit tournament events/i }),
		).toBeInTheDocument();
	});

	it('"Edit tournament events" focuses the first event checkbox', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview')
				return Promise.resolve(
					previewResponse({ missing_event_columns: ['woods'] }),
				);
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fillCreateMetadata();
		await stageFile();

		await waitFor(() =>
			expect(screen.getByTestId('missing-event-banner')).toBeInTheDocument(),
		);

		const btn = screen.getByRole('button', { name: /Edit tournament events/i });
		await act(async () => {
			fireEvent.click(btn);
		});

		// First event checkbox (knockdowns) should now be focused.
		const firstCheckbox = document.querySelector(
			'fieldset input[type="checkbox"]',
		);
		expect(document.activeElement).toBe(firstCheckbox);
	});

	it('renders the missing-required-column banner when the parser reports missing required columns', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview')
				return Promise.reject({
					response: {
						status: 422,
						data: {
							error: 'CSV parsing failed',
							details: {
								errors: [
									'No membership column found (e.g. "member" or "NSL member"). Add the column and re-upload. Use "yes"/"no" — blank cells will be treated as non-members.',
								],
								missing_required_columns: ['is_member'],
							},
						},
					},
				});
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fillCreateMetadata();
		await stageFile();

		await waitFor(() =>
			expect(
				screen.getByTestId('missing-required-banner'),
			).toBeInTheDocument(),
		);
		// Banner has both action affordances.
		expect(
			screen.getByRole('link', { name: /View CSV format guide/i }),
		).toBeInTheDocument();
		// The plain previewError alert is suppressed when the banner is showing.
		expect(
			screen.queryByText(/No membership column found/i),
		).not.toBeInTheDocument();
	});

	it('falls back to the plain preview-error alert when the 422 has no missing_required_columns', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview')
				return Promise.reject({
					response: {
						status: 422,
						data: {
							error: 'CSV parsing failed',
							details: {
								errors: ['Could not parse CSV — check that the file uses comma or tab separators.'],
							},
						},
					},
				});
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fillCreateMetadata();
		await stageFile();

		await waitFor(() =>
			expect(
				screen.getByText(/Could not parse CSV/i),
			).toBeInTheDocument(),
		);
		expect(
			screen.queryByTestId('missing-required-banner'),
		).not.toBeInTheDocument();
	});

	it('opens the commit confirm modal when there are membership flips', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview')
				return Promise.resolve(
					previewResponse({
						membership_changes: [
							{
								name: 'Alice Smith',
								email: 'alice@example.com',
								before: true,
								after: false,
							},
						],
					}),
				);
			if (url === '/upload/commit')
				return Promise.resolve({ data: { tournament_id: 7 } });
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fillCreateMetadata();
		await stageFile();

		await waitFor(() =>
			expect(screen.getByText(/competitors found/i)).toBeInTheDocument(),
		);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));
		});

		// Modal opens — commit not yet sent.
		expect(
			screen.getByRole('heading', { name: /Confirm save/i }),
		).toBeInTheDocument();
		expect(api.post).not.toHaveBeenCalledWith(
			'/upload/commit',
			expect.anything(),
		);

		// Confirm in the modal triggers the actual commit.
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Yes, save now/i }));
		});

		await waitFor(() =>
			expect(api.post).toHaveBeenCalledWith(
				'/upload/commit',
				expect.any(Object),
			),
		);
	});

	it('opens the commit confirm modal when active events are missing columns', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview')
				return Promise.resolve(
					previewResponse({ missing_event_columns: ['woods'] }),
				);
			if (url === '/upload/commit')
				return Promise.resolve({ data: { tournament_id: 8 } });
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fillCreateMetadata();
		await stageFile();

		await waitFor(() =>
			expect(screen.getByText(/competitors found/i)).toBeInTheDocument(),
		);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));
		});

		expect(
			screen.getByRole('heading', { name: /Confirm save/i }),
		).toBeInTheDocument();
		expect(screen.getByText(/Missing event columns/i)).toBeInTheDocument();
	});

	it('opens the commit confirm modal in update mode when existing results will be replaced', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview') return Promise.resolve(previewResponse());
			if (url === '/upload/commit')
				return Promise.resolve({ data: { tournament_id: 99 } });
			throw new Error(`unexpected url ${url}`);
		});

		render(
			<MemoryRouter>
				<TournamentDraftPage
					mode="update"
					tournamentId={99}
					initialMetadata={{
						name: 'Existing Tournament',
						date: '2026-01-01',
						events: {
							has_knockdowns: true,
							has_distance: true,
							has_speed: true,
							has_woods: true,
						},
						points: {
							total_points_knockdowns: 120,
							total_points_distance: 120,
							total_points_speed: 120,
							total_points_woods: 120,
						},
					}}
					existingResultCount={12}
					cancelTo="/admin/tournaments/99"
				/>
			</MemoryRouter>,
		);

		await stageFile();

		await waitFor(() =>
			expect(screen.getByText(/competitors found/i)).toBeInTheDocument(),
		);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));
		});

		expect(
			screen.getByRole('heading', { name: /Confirm save/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/This tournament already has results/i),
		).toBeInTheDocument();
		// Not yet committed.
		expect(api.post).not.toHaveBeenCalledWith(
			'/upload/commit',
			expect.anything(),
		);
	});

	it('sends replace_mode: false when admin chooses "Update existing results"', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview') return Promise.resolve(previewResponse());
			if (url === '/upload/commit')
				return Promise.resolve({ data: { tournament_id: 99 } });
			throw new Error(`unexpected url ${url}`);
		});

		render(
			<MemoryRouter>
				<TournamentDraftPage
					mode="update"
					tournamentId={99}
					initialMetadata={{
						name: 'Existing Tournament',
						date: '2026-01-01',
						events: {
							has_knockdowns: true,
							has_distance: true,
							has_speed: true,
							has_woods: true,
						},
						points: {
							total_points_knockdowns: 120,
							total_points_distance: 120,
							total_points_speed: 120,
							total_points_woods: 120,
						},
					}}
					existingResultCount={12}
					cancelTo="/admin/tournaments/99"
				/>
			</MemoryRouter>,
		);

		await stageFile();
		await waitFor(() =>
			expect(screen.getByText(/competitors found/i)).toBeInTheDocument(),
		);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));
		});

		// Both choice buttons should be rendered side-by-side in the modal.
		expect(
			screen.getByRole('button', { name: /Update existing results/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Replace all results/i }),
		).toBeInTheDocument();

		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', { name: /Update existing results/i }),
			);
		});

		await waitFor(() =>
			expect(api.post).toHaveBeenCalledWith(
				'/upload/commit',
				expect.objectContaining({
					tournament_id: 99,
					replace_mode: false,
				}),
			),
		);
	});

	it('sends replace_mode: true when admin chooses "Replace all results"', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview') return Promise.resolve(previewResponse());
			if (url === '/upload/commit')
				return Promise.resolve({ data: { tournament_id: 99 } });
			throw new Error(`unexpected url ${url}`);
		});

		render(
			<MemoryRouter>
				<TournamentDraftPage
					mode="update"
					tournamentId={99}
					initialMetadata={{
						name: 'Existing Tournament',
						date: '2026-01-01',
						events: {
							has_knockdowns: true,
							has_distance: true,
							has_speed: true,
							has_woods: true,
						},
						points: {
							total_points_knockdowns: 120,
							total_points_distance: 120,
							total_points_speed: 120,
							total_points_woods: 120,
						},
					}}
					existingResultCount={12}
					cancelTo="/admin/tournaments/99"
				/>
			</MemoryRouter>,
		);

		await stageFile();
		await waitFor(() =>
			expect(screen.getByText(/competitors found/i)).toBeInTheDocument(),
		);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));
		});

		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', { name: /Replace all results/i }),
			);
		});

		await waitFor(() =>
			expect(api.post).toHaveBeenCalledWith(
				'/upload/commit',
				expect.objectContaining({
					tournament_id: 99,
					replace_mode: true,
				}),
			),
		);
	});

	it('does NOT open the modal when nothing requires confirmation', async () => {
		api.post.mockImplementation((url) => {
			if (url === '/upload/preview') return Promise.resolve(previewResponse());
			if (url === '/upload/commit')
				return Promise.resolve({ data: { tournament_id: 7 } });
			throw new Error(`unexpected url ${url}`);
		});

		renderPage();
		fillCreateMetadata();
		await stageFile();

		await waitFor(() =>
			expect(screen.getByText(/competitors found/i)).toBeInTheDocument(),
		);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Confirm & Save/i }));
		});

		// No modal heading.
		expect(
			screen.queryByRole('heading', { name: /Confirm save/i }),
		).not.toBeInTheDocument();
		// Commit went through directly.
		await waitFor(() =>
			expect(api.post).toHaveBeenCalledWith(
				'/upload/commit',
				expect.any(Object),
			),
		);
	});
});
