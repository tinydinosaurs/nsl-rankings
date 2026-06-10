import Modal from '../../components/shared/Modal/Modal.jsx';

/**
 * Pre-commit confirmation. Shown only when at least one of three conditions
 * applies:
 *   1. The preview contains membership flips (admin is about to change a
 *      competitor's member/non-member status).
 *   2. The preview is missing one or more active-event columns (admin asked
 *      for an event but the file has no column for it — values will be saved
 *      as "not held").
 *   3. We are in update mode and the tournament already has results that
 *      this commit will replace.
 *
 * One modal, multiple sections — only the sections that apply are rendered.
 * A single Confirm button performs the commit; Cancel just closes the modal.
 */
export default function CommitConfirmModal({
	isOpen,
	onConfirm,
	onCancel,
	membershipChanges = [],
	missingEventColumns = [],
	willReplaceExistingResults = false,
	existingResultCount = 0,
	competitorCount = 0,
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
						<h3>Updating existing results</h3>
						<p>
							This tournament already has <strong>{existingResultCount}</strong>{' '}
							{existingResultCount === 1 ? 'result' : 'results'}. Saving will:
						</p>
						<ul>
							<li>
								<strong>Overwrite</strong> the existing score for any competitor
								who appears in your file.
							</li>
							<li>
								<strong>Add</strong> any competitors in your file who
								aren&apos;t already in this tournament.
							</li>
							<li>
								<strong>Leave alone</strong> any existing results for
								competitors who aren&apos;t in your file. To remove those, use{' '}
								<em>Remove All Results</em> on the tournament page first.
							</li>
						</ul>
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
					<button type="button" className="btn btn-primary" onClick={onConfirm}>
						Yes, save now
					</button>
				</div>
			</div>
		</Modal>
	);
}
