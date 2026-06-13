import Modal from '../../components/shared/Modal/Modal.jsx';

/**
 * Pre-commit confirmation. Shown only when at least one of these conditions
 * applies:
 *   1. The preview contains membership flips (admin is about to change a
 *      competitor's member/non-member status).
 *   2. The preview is missing one or more active-event columns (admin asked
 *      for an event but the file has no column for it — values will be saved
 *      as "not held").
 *   3. We are in update mode and the tournament already has results
 *      (`willReplaceExistingResults`). In this case the footer shows a
 *      three-button choice — Cancel / Update existing results / Replace all
 *      results — and the body copy describes both modes side-by-side so the
 *      admin can choose without leaving the modal.
 *
 * The `onConfirm` callback receives the chosen commit mode:
 *   - `'upsert'`  — overwrite scores for matches, add new competitors, leave
 *                   others alone (the default; server upserts).
 *   - `'replace'` — wipe existing rows for this tournament inside the same
 *                   transaction, then insert from the file.
 *
 * When `willReplaceExistingResults` is false the footer is a single primary
 * confirm button that always calls `onConfirm('upsert')`.
 */
export default function CommitConfirmModal({
	isOpen,
	onConfirm,
	onCancel,
	membershipChanges = [],
	missingEventColumns = [],
	willReplaceExistingResults = false,
	existingResultCount = 0,
}) {
	if (!isOpen) return null;

	return (
		<Modal isOpen={isOpen} onClose={onCancel} title="Confirm save">
			<div className="commit-confirm-modal">
				<p>
					Please review the items below before saving. Once confirmed, these
					changes cannot be undone in one click.
				</p>

				{willReplaceExistingResults && (
					<section className="confirm-section">
						<h3>This tournament already has results</h3>
						<p>
							There {existingResultCount === 1 ? 'is' : 'are'} currently{' '}
							<strong>{existingResultCount}</strong>{' '}
							{existingResultCount === 1 ? 'result' : 'results'} on this
							tournament. Choose how this upload should be applied:
						</p>
						<dl className="commit-mode-choices">
							<dt>Update existing results</dt>
							<dd>
								<strong>Overwrite</strong> the score for any competitor in your
								file, <strong>add</strong> any new competitors in your file, and{' '}
								<strong>leave alone</strong> any existing results for
								competitors who aren&apos;t in your file. Use this when you have
								a partial file — a fix for one score, a missed competitor, etc.
							</dd>
							<dt>Replace all results</dt>
							<dd>
								<strong>Delete every existing result</strong> on this
								tournament, then save the results from your file. Use this when
								the previous upload was wrong, or when a competitor needs to be
								removed from the tournament entirely. This can&apos;t be undone.
							</dd>
						</dl>
					</section>
				)}

				{membershipChanges.length > 0 && (
					<section className="confirm-section">
						<h3>Membership status changes ({membershipChanges.length})</h3>
						<p>
							The following competitors will have their membership status
							updated from their previous record:
						</p>
						<ul>
							{membershipChanges.map((c) => (
								<li key={c.email}>
									<strong>{c.name}</strong> ({c.email}):{' '}
									{c.before ? 'Member' : 'Non-member'} →{' '}
									{c.after ? 'Member' : 'Non-member'}
								</li>
							))}
						</ul>
					</section>
				)}

				{missingEventColumns.length > 0 && (
					<section className="confirm-section">
						<h3>Missing event columns</h3>
						<p>
							You marked{' '}
							{missingEventColumns.length === 1 ? 'this event' : 'these events'}{' '}
							as active, but the file has no matching column. They will be saved
							as <em>not held</em> for every competitor in this upload:
						</p>
						<ul>
							{missingEventColumns.map((e) => (
								<li key={e}>{e}</li>
							))}
						</ul>
						<p>
							If that&apos;s wrong, cancel and either pick a different file or
							uncheck the affected event in tournament details.
						</p>
					</section>
				)}

				<div className="button-row">
					<button type="button" className="btn btn-ghost" onClick={onCancel}>
						Cancel
					</button>
					{willReplaceExistingResults ? (
						<>
							<button
								type="button"
								className="btn btn-primary"
								onClick={() => onConfirm('upsert')}
							>
								Update existing results
							</button>
							<button
								type="button"
								className="btn btn-danger"
								onClick={() => onConfirm('replace')}
							>
								Replace all results
							</button>
						</>
					) : (
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => onConfirm('upsert')}
						>
							Yes, save now
						</button>
					)}
				</div>
			</div>
		</Modal>
	);
}
