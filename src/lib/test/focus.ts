/**
 * How far the front camera says it is focused: the one distance a browser
 * gives a page about the front camera, and only Chrome on Android gives it.
 * The guided test shows it in the step bar while the card is being placed.
 *
 * Hard rule 4 says the app never measures anything while the mirror runs.
 * This is an exception the user decided on (2026-10-03) for the guided test
 * only, which is deleted before any release, and it reads the camera's own
 * focus report, never the picture. It must not move into the mirror:
 * `check:privacy` rejects `focusDistance` anywhere outside the test.
 *
 * Plain functions, no DOM.
 */

/** How often the page reads the focus distance while the card is being placed. */
export const FOCUS_POLL_MS = 250;

/**
 * Nearer or further than this is not a card on a table: it is a camera
 * focused at infinity, or a lens whose numbers are not calibrated in metres.
 */
const NEAREST_M = 0.05;
const FURTHEST_M = 3;

/** The focus distance in metres from a track's settings, when it is a plausible one. */
export function readFocus(settings: MediaTrackSettings | undefined): number | null {
	const value = (settings as { focusDistance?: unknown } | undefined)?.focusDistance;
	return typeof value === 'number' && value >= NEAREST_M && value <= FURTHEST_M ? value : null;
}

/**
 * What has been read on the current step. `moved` is what shows the value is
 * live: a browser that has stopped refreshing it would report the same number
 * however far the card went, and that number must not be shown.
 */
export interface FocusState {
	first: number | null;
	last: number | null;
	moved: boolean;
}

export const FOCUS_START: FocusState = { first: null, last: null, moved: false };

/** Take one reading in. A missing reading changes nothing. */
export function nextFocus(state: FocusState, reading: number | null): FocusState {
	if (reading === null) return state;
	const first = state.first ?? reading;
	return { first, last: reading, moved: state.moved || reading !== first };
}

/** What the step bar shows: nothing until the reading has moved on this step. */
export function focusText(state: FocusState): string | null {
	if (!state.moved || state.last === null) return null;
	return `focused at ${Math.round(state.last * 100)} cm`;
}
