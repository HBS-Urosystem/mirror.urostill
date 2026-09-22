import { describe, expect, it } from 'vitest';
import { normaliseWheelDelta, wheelZoomRatio } from '../../src/lib/gestures.svelte';
import { WHEEL_LINE_PX, WHEEL_NOTCH_PX, WHEEL_PAGE_PX } from '../../src/lib/config';

describe('normaliseWheelDelta', () => {
	it('passes pixel deltas straight through', () => {
		expect(normaliseWheelDelta(100, 0)).toBe(100);
		expect(normaliseWheelDelta(-53.5, 0)).toBe(-53.5);
	});

	it('converts line and page deltas, which Firefox and others still send', () => {
		expect(normaliseWheelDelta(3, 1)).toBe(3 * WHEEL_LINE_PX);
		expect(normaliseWheelDelta(-1, 2)).toBe(-WHEEL_PAGE_PX);
	});

	it('keeps the direction whatever the unit', () => {
		for (const mode of [0, 1, 2]) {
			expect(normaliseWheelDelta(-1, mode)).toBeLessThan(0);
			expect(normaliseWheelDelta(1, mode)).toBeGreaterThan(0);
		}
	});
});

describe('wheelZoomRatio', () => {
	it('zooms in when scrolling up and out when scrolling down', () => {
		expect(wheelZoomRatio(-WHEEL_NOTCH_PX, false)).toBeGreaterThan(1);
		expect(wheelZoomRatio(WHEEL_NOTCH_PX, false)).toBeLessThan(1);
	});

	it('is exactly one step per notch', () => {
		expect(wheelZoomRatio(-WHEEL_NOTCH_PX, false, 1.15)).toBeCloseTo(1.15, 6);
		expect(wheelZoomRatio(WHEEL_NOTCH_PX, false, 1.15)).toBeCloseTo(1 / 1.15, 6);
	});

	it('composes: two notches are one step squared, so the feel is even', () => {
		const one = wheelZoomRatio(-WHEEL_NOTCH_PX, false);
		const two = wheelZoomRatio(-2 * WHEEL_NOTCH_PX, false);
		expect(two).toBeCloseTo(one * one, 6);
	});

	it('does nothing on a zero delta', () => {
		expect(wheelZoomRatio(0, false)).toBe(1);
		expect(wheelZoomRatio(0, true)).toBe(1);
	});

	it('gives a trackpad the fine steps it actually sends', () => {
		// A trackpad pinch arrives as a stream of deltas of a few units each,
		// where a wheel sends one notch of about a hundred. Per event, the
		// trackpad must move far less, or a pinch would fly to the zoom limit.
		const perPinchEvent = wheelZoomRatio(-2, true);
		expect(perPinchEvent).toBeGreaterThan(1);
		expect(perPinchEvent).toBeLessThan(wheelZoomRatio(-WHEEL_NOTCH_PX, false));
	});

	it('adds up over a pinch the way the fingers expect', () => {
		// Twenty events of two units each is the same as one of forty.
		let ratio = 1;
		for (let i = 0; i < 20; i++) ratio *= wheelZoomRatio(-2, true);
		expect(ratio).toBeCloseTo(wheelZoomRatio(-40, true), 6);
	});

	it('is symmetric, so a pinch out undoes a pinch in', () => {
		expect(wheelZoomRatio(-25, true) * wheelZoomRatio(25, true)).toBeCloseTo(1, 10);
		expect(wheelZoomRatio(-250, false) * wheelZoomRatio(250, false)).toBeCloseTo(1, 10);
	});
});
