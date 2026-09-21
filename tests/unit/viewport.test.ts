import { describe, expect, it } from 'vitest';
import { coverScale, pictureSize, sourcePixelsPerScreenPixel } from '../../src/lib/viewport';

describe('coverScale', () => {
	it('fits the height when a wide stream meets a tall stage', () => {
		expect(coverScale({ w: 400, h: 800 }, { w: 1920, h: 1080 })).toBeCloseTo(800 / 1080, 10);
	});

	it('fits the width when a tall stage turns landscape', () => {
		expect(coverScale({ w: 800, h: 400 }, { w: 640, h: 480 })).toBeCloseTo(1.25, 10);
	});

	it('is 1 when the stream matches the stage exactly', () => {
		expect(coverScale({ w: 1920, h: 1080 }, { w: 1920, h: 1080 })).toBe(1);
	});

	it('falls back to 1 before the stream size is known', () => {
		expect(coverScale({ w: 400, h: 800 }, { w: 0, h: 0 })).toBe(1);
	});
});

describe('pictureSize', () => {
	it('covers the stage with no empty edge', () => {
		const stage = { w: 400, h: 800 };
		const picture = pictureSize(stage, { w: 1920, h: 1080 });
		expect(picture.w).toBeGreaterThanOrEqual(stage.w);
		expect(picture.h).toBeCloseTo(stage.h, 10);
		expect(picture.w / picture.h).toBeCloseTo(1920 / 1080, 10);
	});

	it('keeps the stream aspect ratio after a rotation swaps it', () => {
		const stage = { w: 400, h: 800 };
		const portrait = pictureSize(stage, { w: 1080, h: 1920 });
		expect(portrait.h).toBeCloseTo(stage.h, 10);
		expect(portrait.w).toBeGreaterThanOrEqual(stage.w);
		expect(portrait.w / portrait.h).toBeCloseTo(1080 / 1920, 10);
	});

	it('matches the stage before the stream size is known, so nothing jumps', () => {
		expect(pictureSize({ w: 400, h: 800 }, { w: 0, h: 0 })).toEqual({ w: 400, h: 800 });
	});
});

describe('sourcePixelsPerScreenPixel', () => {
	it('drops as the cover scale, the zoom or the pixel ratio rises', () => {
		expect(sourcePixelsPerScreenPixel(0.5, 1, 1)).toBeCloseTo(2, 10);
		expect(sourcePixelsPerScreenPixel(0.5, 2, 1)).toBeCloseTo(1, 10);
		expect(sourcePixelsPerScreenPixel(0.5, 2, 3)).toBeCloseTo(1 / 3, 10);
	});

	it('is 0 for nonsense input rather than Infinity', () => {
		expect(sourcePixelsPerScreenPixel(0, 1, 1)).toBe(0);
		expect(sourcePixelsPerScreenPixel(1, 0, 1)).toBe(0);
		expect(sourcePixelsPerScreenPixel(1, 1, 0)).toBe(0);
	});
});
