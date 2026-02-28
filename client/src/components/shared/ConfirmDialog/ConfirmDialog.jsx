import Modal from '../Modal/Modal.jsx';

export default function ConfirmDialog({
	isOpen,
	onConfirm,
	onCancel,
	title = 'Are you sure?',
	message,
	confirmLabel = 'Confirm',
	variant = 'danger',
}) {
	return (
		<Modal isOpen={isOpen} onClose={onCancel} title={title}>
			<p>{message}</p>
			<div className="modal-actions">
				<button className="btn-secondary" onClick={onCancel}>
					Cancel
				</button>
				<button
					className={`btn-${variant}`}
					onClick={onConfirm}
				>
					{confirmLabel}
				</button>
			</div>
		</Modal>
	);
}
