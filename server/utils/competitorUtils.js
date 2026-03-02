/**
 * Generates a placeholder email for competitors without a real email address.
 * Format: firstname.lastname.nsl@placeholder.local
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
