import { describe, expect, it } from 'vitest';
import { benchSettings, runSetting } from '../../src/lib/motion/bench';

describe('benchSettings', () => {
	it('covers every combination of the three levers', () => {
		const settings = benchSettings();
		expect(settings).toHaveLength(3 * 2 * 2);
		expect(
			new Set(settings.map((s) => `${s.width}-${s.sampleStep}-${s.refineSearchPx}`)).size
		).toBe(settings.length);
	});

	it('keeps every frame 4:3, as the analysis frame is', () => {
		for (const setting of benchSettings()) {
			expect(setting.width / setting.height).toBeCloseTo(4 / 3, 6);
		}
	});
});

describe('runSetting', () => {
	it('returns a cost and an accuracy that can be compared', () => {
		const result = runSetting({ width: 128, height: 96, sampleStep: 2, refineSearchPx: 3 }, 20);

		expect(result.msPerFrame).toBeGreaterThan(0);
		expect(Number.isFinite(result.msPerFrame)).toBe(true);
		expect(result.acceptedFraction).toBeGreaterThan(0);
		expect(result.acceptedFraction).toBeLessThanOrEqual(1);
		expect(result.worstAcceptedPx).toBeLessThanOrEqual(0.5);
	}, 30000);

	it('shows that the fine search cannot be narrowed at the smallest size', () => {
		// Measured on a laptop and reproduced here: at 128×96 the coarse level
		// is too small to hand the fine level something a ±2 window can fix.
		const narrow = runSetting({ width: 128, height: 96, sampleStep: 1, refineSearchPx: 2 }, 20);
		const wide = runSetting({ width: 128, height: 96, sampleStep: 1, refineSearchPx: 3 }, 20);

		expect(narrow.worstAcceptedPx).toBeGreaterThan(0.5);
		expect(wide.worstAcceptedPx).toBeLessThanOrEqual(0.5);
	}, 30000);
});
