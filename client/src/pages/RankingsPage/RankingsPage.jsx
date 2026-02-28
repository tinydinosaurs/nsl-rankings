import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	flexRender,
	createColumnHelper,
} from '@tanstack/react-table';
import api from '../../utils/api';
import './RankingsPage.css';

const columnHelper = createColumnHelper();

function ScoreCell({ value }) {
	if (value === null || value === undefined)
		return <span className="score-null">—</span>;
	const pct = Math.round(value * 10) / 10;
	const hue = (pct / 100) * 120; // red → green
	return (
		<span className="score-cell" style={{ color: `hsl(${hue}, 70%, 65%)` }}>
			{pct.toFixed(1)}
		</span>
	);
}

export default function RankingsPage() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [sorting, setSorting] = useState([{ id: 'total', desc: true }]);
	const navigate = useNavigate();

	useEffect(() => {
		// Use public endpoint since leaderboard should be publicly accessible
		api.get('/rankings/public')
			.then((res) => setData(res.data))
			.catch(() => setError('Failed to load rankings'))
			.finally(() => setLoading(false));
	}, []);

	const columns = useMemo(
		() => [
			columnHelper.accessor('rank', {
				header: '#',
				cell: (info) => (
					<span className="rank-num">{info.getValue()}</span>
				),
				size: 48,
			}),
			columnHelper.accessor('name', {
				header: 'Competitor',
				cell: (info) => (
					<button
						className="competitor-link"
						onClick={() =>
							navigate(`/competitors/${info.row.original.id}`)
						}
					>
						{info.getValue()}
					</button>
				),
			}),
			columnHelper.accessor('knockdowns', {
				header: 'Knockdowns',
				cell: (info) => <ScoreCell value={info.getValue()} />,
			}),
			columnHelper.accessor('distance', {
				header: 'Distance',
				cell: (info) => <ScoreCell value={info.getValue()} />,
			}),
			columnHelper.accessor('speed', {
				header: 'Speed',
				cell: (info) => <ScoreCell value={info.getValue()} />,
			}),
			columnHelper.accessor('woods', {
				header: 'Woods Course',
				cell: (info) => <ScoreCell value={info.getValue()} />,
			}),
			columnHelper.accessor('total', {
				header: 'Total Score',
				cell: (info) => <ScoreCell value={info.getValue()} />,
			}),
		],
		[navigate],
	);

	// eslint-disable-next-line react-hooks/incompatible-library
	const table = useReactTable({
		data,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	if (loading) return <div className="page-loading">Loading rankings…</div>;
	if (error) return <div className="alert alert-error">{error}</div>;

	return (
		<div className="rankings-page">
			<div className="page-header">
				<h1>National Rankings</h1>
				<span className="competitor-count">
					{data.length} competitors
				</span>
			</div>

			{data.length === 0 ? (
				<div className="card empty-state">
					<p>
						No rankings yet. Upload a CSV or add results manually to
						get started.
					</p>
				</div>
			) : (
				<div className="table-wrapper card">
					<table className="rankings-table">
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
											style={{
												width:
													header.getSize() !== 150
														? header.getSize()
														: undefined,
											}}
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
		</div>
	);
}
