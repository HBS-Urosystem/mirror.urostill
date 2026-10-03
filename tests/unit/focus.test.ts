import { describe, expect, it } from 'vitest';
import {
	FOCUS_START,
	focusText,
	nextFocus,
	readFocus,
	type FocusState
} from '../../src/lib/test/focus';

/** The state after taking these readings in, one after another, as the page does. */
const after = (...readings: (number | null)[]): FocusState =>
	readings.reduce<FocusState>((state, r) => nextFocus(state, r), FOCUS_START);

describe('readFocus', () => {
	it('reads a focus distance in metres', () => {
		expect(readFocus({ focusDistance: 0.35 } as MediaTrackSettings)).toBe(0.35);
	});

	it('ignores what cannot be a card on a table: zero, infinity focus, uncalibrated numbers', () => {
		expect(readFocus({ focusDistance: 0 } as MediaTrackSettings)).toBeNull();
		expect(readFocus({ focusDistance: 10 } as MediaTrackSettings)).toBeNull();
		expect(readFocus({ focusDistance: Infinity } as MediaTrackSettings)).toBeNull();
	});

	it('gives nothing when the camera does not say', () => {
		expect(readFocus({} as MediaTrackSettings)).toBeNull();
		expect(readFocus(undefined)).toBeNull();
	});
});

describe('focusText', () => {
	it('shows nothing while the reading has not changed: it may be one the browser stopped refreshing', () => {
		expect(focusText(after(0.35, 0.35, 0.35))).toBeNull();
	});

	it('shows the latest distance once the reading has moved', () => {
		expect(focusText(after(0.4, 0.37, 0.34))).toBe('focused at 34 cm');
	});

	it('stays shown when the card comes back to where it started', () => {
		expect(focusText(after(0.35, 0.3, 0.35))).toBe('focused at 35 cm');
	});

	it('passes over missing readings', () => {
		expect(focusText(after(null, 0.4, null, 0.45))).toBe('focused at 45 cm');
		expect(focusText(after(null, null))).toBeNull();
	});

	it('rounds to whole centimetres', () => {
		expect(focusText(after(0.4, 0.344))).toBe('focused at 34 cm');
		expect(focusText(after(0.4, 0.346))).toBe('focused at 35 cm');
	});
});
