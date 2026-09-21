import { describe, expect, it } from 'vitest';
import {
	centreContentPoint,
	clampTranslation,
	clampZoom,
	fromNormalised,
	pan,
	pictureSize,
	pinch,
	toNormalised,
	translationBound,
	translationForCentre,
	type Size,
	type Vec,
	type View
} from '../../src/lib/viewport';

/** A tall stage showing a 16:9 stream: 1422.2 × 800 of picture in 400 × 800 of stage. */
const stage: Size = { w: 400, h: 800 };
const stream: Size = { w: 1920, h: 1080 };
const picture = pictureSize(stage, stream);
const limits = { min: 1, max: 5 };

/** The acceptance criterion, as a predicate: no empty edge, ever. */
function covers(view: View, p: Size = picture, s: Size = stage): boolean {
	// The picture spans t ± half; it must contain the stage, which spans ± size/2.
	const half = { x: (view.s * p.w) / 2, y: (view.s * p.h) / 2 };
	return (
		Math.abs(view.t.x) <= half.x - s.w / 2 + 1e-9 && Math.abs(view.t.y) <= half.y - s.h / 2 + 1e-9
	);
}

describe('clampZoom', () => {
	it('holds the zoom inside the configured range', () => {
		expect(clampZoom(0.2, 1, 5)).toBe(1);
		expect(clampZoom(2.5, 1, 5)).toBe(2.5);
		expect(clampZoom(50, 1, 5)).toBe(5);
	});
});

describe('translationBound', () => {
	it('allows sideways movement but none vertically when the picture fits exactly', () => {
		const bound = translationBound(1, picture, stage);
		expect(bound.x).toBeCloseTo((picture.w - stage.w) / 2, 6);
		expect(bound.y).toBeCloseTo(0, 6);
	});

	it('grows with the zoom', () => {
		expect(translationBound(2, picture, stage).y).toBeCloseTo((2 * picture.h - stage.h) / 2, 6);
	});

	it('is never negative, so a picture smaller than the stage stays centred', () => {
		const bound = translationBound(1, { w: 100, h: 100 }, stage);
		expect(bound).toEqual({ x: 0, y: 0 });
	});
});

describe('clampTranslation', () => {
	it('never lets an empty edge show', () => {
		for (const s of [1, 1.3, 2, 3.7, 5]) {
			for (const t of [
				{ x: 0, y: 0 },
				{ x: 10000, y: 10000 },
				{ x: -10000, y: 4000 },
				{ x: 250, y: -75 }
			]) {
				expect(covers({ s, t: clampTranslation(t, s, picture, stage) })).toBe(true);
			}
		}
	});
});

describe('pan', () => {
	const start: View = { s: 2, t: { x: 0, y: 0 } };

	it('moves by the whole displacement since the drag began', () => {
		expect(pan(start, { x: 30, y: -40 }, picture, stage).t).toEqual({ x: 30, y: -40 });
	});

	it('stops at the edge instead of revealing one', () => {
		const panned = pan(start, { x: 99999, y: 0 }, picture, stage);
		expect(panned.t.x).toBeCloseTo(translationBound(2, picture, stage).x, 6);
		expect(covers(panned)).toBe(true);
	});

	it('comes straight back off the edge, without sticking', () => {
		const atEdge = pan(start, { x: 99999, y: 0 }, picture, stage);
		const back = pan(atEdge, { x: -50, y: 0 }, picture, stage);
		expect(back.t.x).toBeCloseTo(atEdge.t.x - 50, 6);
	});

	it('leaves the zoom alone', () => {
		expect(pan(start, { x: 5, y: 5 }, picture, stage).s).toBe(2);
	});
});

describe('pinch', () => {
	/** Where a content point currently lands on screen, relative to the stage centre. */
	const screenPoint = (view: View, c: Vec): Vec => ({
		x: view.s * c.x + view.t.x,
		y: view.s * c.y + view.t.y
	});

	it('keeps the content under the fingers under the fingers', () => {
		const start: View = { s: 1, t: { x: 0, y: 0 } };
		const midpoint = { x: 100, y: 0 };
		const held = { x: (midpoint.x - start.t.x) / start.s, y: (midpoint.y - start.t.y) / start.s };

		for (const ratio of [1.2, 2, 3]) {
			const after = pinch(start, midpoint, ratio, picture, stage, limits);
			expect(screenPoint(after, held).x).toBeCloseTo(midpoint.x, 6);
		}
	});

	it('obeys the zoom limits', () => {
		const start: View = { s: 2, t: { x: 0, y: 0 } };
		expect(pinch(start, { x: 0, y: 0 }, 10, picture, stage, limits).s).toBe(5);
		expect(pinch(start, { x: 0, y: 0 }, 0.01, picture, stage, limits).s).toBe(1);
	});

	it('works from the gesture start, so a long pinch cannot drift', () => {
		const start: View = { s: 1, t: { x: 0, y: 0 } };
		const midpoint = { x: 40, y: 20 };
		const once = pinch(start, midpoint, 3, picture, stage, limits);
		const stepped = [1.5, 2.2, 3].reduce(
			(_, ratio) => pinch(start, midpoint, ratio, picture, stage, limits),
			start
		);
		expect(stepped.s).toBeCloseTo(once.s, 10);
		expect(stepped.t.x).toBeCloseTo(once.t.x, 10);
	});

	it('never reveals an edge, even zooming out against the clamp', () => {
		const zoomedIn = pinch(
			{ s: 1, t: { x: 0, y: 0 } },
			{ x: 180, y: 380 },
			5,
			picture,
			stage,
			limits
		);
		const backOut = pinch(zoomedIn, { x: 180, y: 380 }, 0.2, picture, stage, limits);
		expect(covers(zoomedIn)).toBe(true);
		expect(covers(backOut)).toBe(true);
		expect(backOut.s).toBe(1);
	});
});

describe('normalised picture coordinates', () => {
	it('round-trip through the stage centre', () => {
		const view: View = { s: 2.5, t: { x: -120, y: 60 } };
		const c = centreContentPoint(view);
		const back = fromNormalised(toNormalised(c, picture), picture);
		expect(back.x).toBeCloseTo(c.x, 9);
		expect(back.y).toBeCloseTo(c.y, 9);
	});

	it('put the middle of the picture at 0.5, 0.5', () => {
		expect(toNormalised({ x: 0, y: 0 }, picture)).toEqual({ x: 0.5, y: 0.5 });
	});

	it('fall back to the middle before the picture has a size', () => {
		expect(toNormalised({ x: 0, y: 0 }, { w: 0, h: 0 })).toEqual({ x: 0.5, y: 0.5 });
	});
});

describe('translationForCentre', () => {
	it('reproduces a view exactly, so storing the centre loses nothing', () => {
		const view: View = { s: 3, t: clampTranslation({ x: -200, y: 300 }, 3, picture, stage) };
		const u = toNormalised(centreContentPoint(view), picture);
		const again = translationForCentre(u, view.s, picture, stage);
		expect(again.x).toBeCloseTo(view.t.x, 9);
		expect(again.y).toBeCloseTo(view.t.y, 9);
	});

	it('keeps the same point centred when the phone rotates', () => {
		const chosen = { x: 0.62, y: 0.41 };
		const landscape: Size = { w: 800, h: 400 };
		// The stream swaps its sides too, so the picture is recomputed from both.
		const rotated = pictureSize(landscape, { w: 1080, h: 1920 });
		const t = translationForCentre(chosen, 2, rotated, landscape);
		const centred = toNormalised(centreContentPoint({ s: 2, t }), rotated);
		expect(centred.x).toBeCloseTo(chosen.x, 9);
		expect(centred.y).toBeCloseTo(chosen.y, 9);
		expect(covers({ s: 2, t }, rotated, landscape)).toBe(true);
	});

	it('pulls the view back inside the picture when the zoom is reset', () => {
		const zoomedEdge = { x: 0.95, y: 0.95 };
		const reset = translationForCentre(zoomedEdge, 1, picture, stage);
		expect(covers({ s: 1, t: reset })).toBe(true);
		expect(reset.y).toBeCloseTo(0, 6);
	});
});
