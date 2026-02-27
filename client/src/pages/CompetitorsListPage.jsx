import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	flexRender,
	createColumnHelper,
} from '@tanstack/react-table';
import api from '../utils/api';
import './CompetitorsListPage.css';

const columnHelper = createColumnHelper();

function EmailStatusBadge({ competitor }) {
	if (competitor.has_placeholder_email) {
		return <span className="badge badge-warning">Placeholder Email</span>;
	}
	return <span className="badge badge-success">Email Verified</span>;
}

function AddCompetitorModal({ isOpen, onClose, onAdd }) {
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!name.trim()) {
			setError('Name is required');
			return;
		}

		setIsSubmitting(true);
		setError('');

		try {
			await api.post('/rankings/competitors', {
				name: name.trim(),
				email: email.trim() || undefined,
			});
			onAdd();
			setName('');
			setEmail('');
			onClose();
		} catch (err) {
			setError(err.response?.data?.error || 'Failed to add competitor');
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h3>Add Competitor</h3>
					<button className="modal-close" onClick={onClose}>
						×
					</button>
				</div>

				<form onSubmit={handleSubmit} className="modal-body">
					{error && <div className="alert alert-error">{error}</div>}

					<div className="form-group">
						<label htmlFor="competitor-name">Name *</label>
						<input
							id="competitor-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Enter competitor's full name"
							required
						/>
					</div>

					<div className="form-group">
						<label htmlFor="competitor-email">Email</label>
						<input
							id="competitor-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="competitor@example.com (optional)"
						/>
						<small className="form-help">
							If empty, a placeholder email will be generated
						</small>
					</div>

					<div className="modal-actions">
						<button
							type="button"
							className="btn-secondary"
							onClick={onClose}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="btn-primary"
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Adding...' : 'Add Competitor'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default function CompetitorsListPage() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
	const [filtering, setFiltering] = useState('');
	const [showPlaceholdersOnly, setShowPlaceholdersOnly] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const navigate = useNavigate();

	const loadCompetitors = async () => {
		setLoading(true);
		try {
			const endpoint = showPlaceholdersOnly
				? '/rankings/competitors?filter=placeholder-emails'
				: '/rankings/competitors';
			const res = await api.get(endpoint);
			setData(res.data);
			setError('');
		} catch (err) {
			setError('Failed to load competitors');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadCompetitors();
	}, [showPlaceholdersOnly]);

	const handleDelete = async (competitor) => {
		const tournamentText =
			competitor.tournament_count > 0
				? ` and ${competitor.tournament_count} tournament result(s)`
				: '';

		const confirmed = window.confirm(
			`Delete "${competitor.name}"${tournamentText}?\n\nThis cannot be undone.`,
		);

		if (!confirmed) return;

		try {
			await api.delete(`/rankings/competitors/${competitor.id}`);
			loadCompetitors();
		} catch (err) {
			setError(
				err.response?.data?.error || 'Failed to delete competitor',
			);
		}
	};

	const columns = useMemo(
		() => [
			columnHelper.accessor('name', {
				header: 'Name',
				cell: (info) => (
					<button
						className="competitor-link"
						onClick={() =>
							navigate(
								`/admin/competitors/${info.row.original.id}`,
							)
						}
					>
						{info.getValue()}
					</button>
				),
			}),
			columnHelper.accessor('email', {
				header: 'Email Status',
				cell: (info) => (
					<EmailStatusBadge competitor={info.row.original} />
				),
				enableSorting: false,
			}),
			columnHelper.accessor('total_score', {
				header: 'Total Score',
				cell: (info) => {
					const value = info.getValue();
					if (value === null || value === 0)
						return <span className="score-null">—</span>;
					return (
						<span className="score-value">{value.toFixed(1)}</span>
					);
				},
			}),
			columnHelper.accessor('tournament_count', {
				header: 'Tournaments',
				cell: (info) => {
					const count = info.getValue();
					return <span className="tournament-count">{count}</span>;
				},
			}),
			columnHelper.display({
				id: 'actions',
				header: 'Actions',
				cell: (info) => (
					<button
						className="btn-danger btn-small"
						onClick={() => handleDelete(info.row.original)}
					>
						Delete
					</button>
				),
				enableSorting: false,
			}),
		],
		[navigate],
	);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			globalFilter: filtering,
		},
		onSortingChange: setSorting,
		onGlobalFilterChange: setFiltering,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	if (loading)
		return <div className="page-loading">Loading competitors…</div>;

	return (
		<div className="competitors-list-page">
			<div className="page-header">
				<div className="page-title">
					<h1>Competitors</h1>
					<span className="competitor-count">
						{data.length} competitors
					</span>
				</div>
				<button
					className="btn-primary"
					onClick={() => setShowAddModal(true)}
				>
					Add Competitor
				</button>
			</div>

			{error && <div className="alert alert-error">{error}</div>}

			<div className="page-controls">
				<div className="search-controls">
					<input
						type="text"
						placeholder="Search competitors..."
						value={filtering}
						onChange={(e) => setFiltering(e.target.value)}
						className="search-input"
					/>
				</div>

				<div className="filter-controls">
					<label className="checkbox-label">
						<input
							type="checkbox"
							checked={showPlaceholdersOnly}
							onChange={(e) =>
								setShowPlaceholdersOnly(e.target.checked)
							}
						/>
						Show only placeholder emails
					</label>
				</div>
			</div>

			{data.length === 0 ? (
				<div className="card empty-state">
					{showPlaceholdersOnly ? (
						<p>No competitors with placeholder emails found.</p>
					) : filtering ? (
						<p>No competitors match your search.</p>
					) : (
						<p>
							No competitors yet. Add some competitors to get
							started.
						</p>
					)}
				</div>
			) : (
				<div className="table-wrapper card">
					<table className="competitors-table">
						<thead>
							{table.getHeaderGroups().map((hg) => (
								<tr key={hg.id}>
									{hg.headers.map((header) => (
										<th
											key={header.id}
											onClick={header.column.getToggleSortingHandler()}
											className={
												header.column.getCanSort()
													? 'sortable'
													: ''
											}
										>
											{flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
											{header.column.getIsSorted() ===
												'asc' && ' ↑'}
											{header.column.getIsSorted() ===
												'desc' && ' ↓'}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.map((row) => (
								<tr key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<AddCompetitorModal
				isOpen={showAddModal}
				onClose={() => setShowAddModal(false)}
				onAdd={loadCompetitors}
			/>
		</div>
	);
}
