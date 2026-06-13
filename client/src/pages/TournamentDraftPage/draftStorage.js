/**
 * sessionStorage layer for the in-progress tournament draft.
 *
 * Only metadata is persisted — the staged File and parsed preview live in
 * React state (Files can't be JSON-serialized; see notes/UPLOAD_FLOW_REFACTOR.md).
 *
 * Single-slot: there is at most one draft. Starting a second prompts to
 * resume or discard.
 */

const DRAFT_KEY = 'nsl:draft:tournament';
const DRAFT_VERSION = 1;

const todayIso = () => new Date().toISOString().slice(0, 10);

export function defaultMetadata() {
	return {
		name: '',
		date: todayIso(),
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
	};
}

/**
 * True if the given metadata deep-equals the default-shape draft (blank name,
 * today's date, all events on, all totals 120). Used to decide whether to
 * confirm on Cancel and whether to show the resume prompt on mount.
 */
export function isEmptyMetadata(metadata) {
	const d = defaultMetadata();
	if (metadata.name.trim() !== '') return false;
	if (metadata.date !== d.date) return false;
	for (const k of Object.keys(d.events)) {
		if (metadata.events[k] !== d.events[k]) return false;
	}
	for (const k of Object.keys(d.points)) {
		if (metadata.points[k] !== d.points[k]) return false;
	}
	return true;
}

export function loadDraft() {
	try {
		const raw = sessionStorage.getItem(DRAFT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed?.version !== DRAFT_VERSION) {
			sessionStorage.removeItem(DRAFT_KEY);
			return null;
		}
		// Trust the stored metadata shape; we're pre-launch and there's no
		// migration story. If the shape ever changes, bump DRAFT_VERSION.
		return {
			metadata: parsed.metadata,
			hadFile: !!parsed.hadFile,
		};
	} catch {
		try {
			sessionStorage.removeItem(DRAFT_KEY);
		} catch {
			// sessionStorage unavailable — nothing to do.
		}
		return null;
	}
}

export function saveDraft(metadata, { hadFile = false } = {}) {
	try {
		sessionStorage.setItem(
			DRAFT_KEY,
			JSON.stringify({
				version: DRAFT_VERSION,
				updatedAt: new Date().toISOString(),
				metadata,
				hadFile,
			}),
		);
	} catch {
		// sessionStorage unavailable or quota exceeded — silently drop.
	}
}

export function clearDraft() {
	try {
		sessionStorage.removeItem(DRAFT_KEY);
	} catch {
		// sessionStorage unavailable — nothing to do.
	}
}
