/**
 * Generates a placeholder email for competitors without a real email address.
 * Format: firstname.lastname.nsl@placeholder.local
 *
 * INTENTIONALLY deterministic — the same name always produces the same placeholder.
 * This means the same unnamed competitor will be unified across uploads, which is
 * usually correct for a small community. However, two different people with the same
 * name will also be merged. Admins should assign real emails via the admin panel to
 * resolve any ambiguity.
 *
 * This is the single source of truth for placeholder email generation.
 */
function generatePlaceholderEmail(name) {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '.')
		.replace(/^\.|\.$/, '');
	return `${slug}.nsl@placeholder.local`;
}

/**
 * Returns true if the given email is a system-generated placeholder.
 */
function isPlaceholderEmail(email) {
	return !email || email.endsWith('.nsl@placeholder.local');
}

module.exports = { generatePlaceholderEmail, isPlaceholderEmail };
