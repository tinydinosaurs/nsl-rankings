import { useState, useEffect, useMemo } from 'react';
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
	return <span className="score-cell">{pct.toFixed(1)}</span>;
}

export default function RankingsPage() {
	const [data, setData] = useState([]);
	const [meta, setMeta] = useState({
		tournament_count: null,
		last_updated: null,
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [sorting, setSorting] = useState([{ id: 'total', desc: true }]);

	useEffect(() => {
		api
			.get('/rankings/public')
			.then((res) => {
				setData(res.data.rankings);
				setMeta({
					tournament_count: res.data.tournament_count,
					last_updated: res.data.last_updated,
				});
			})
			.catch(() => setError('Failed to load rankings'))
			.finally(() => setLoading(false));
	}, []);

	const columns = useMemo(
		() => [
			columnHelper.accessor('rank', {
				header: '#',
				cell: (info) => <span className="rank-num">{info.getValue()}</span>,
				size: 48,
			}),
			columnHelper.accessor('name', {
				header: 'Competitor',
				cell: (info) => info.getValue(),
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
		[],
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
				<div className="rankings-meta">
					{meta.tournament_count != null && (
						<span className="meta-stat">
							{data.length} competitor{data.length !== 1 ? 's' : ''} &middot;{' '}
							{meta.tournament_count} tournament
							{meta.tournament_count !== 1 ? 's' : ''}
						</span>
					)}
					{meta.last_updated && (
						<span className="meta-updated">Updated {meta.last_updated}</span>
					)}
				</div>
			</div>

			{data.length === 0 ? (
				<div className="card empty-state">
					<p>
						No rankings yet. Results will appear here once an admin uploads
						tournament data.
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
											className={header.column.getCanSort() ? 'sortable' : ''}
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
											{header.column.getIsSorted() === 'asc' && ' ↑'}
											{header.column.getIsSorted() === 'desc' && ' ↓'}
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
