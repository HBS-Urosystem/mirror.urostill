import { describe, expect, it } from 'vitest';
import { HALO_LEVELS } from '../../src/lib/config';
import {
	easeOutCubic,
	haloWidth,
	maxHaloWidth,
	nextHaloLevel,
	stageSize,
	sunRays
} from '../../src/lib/halo';

describe('haloWidth', () => {
	it('measures against the short side, whichever way the phone is held', () => {
		const portrait = haloWidth('bright', { w: 393, h: 852 });
		const landscape = haloWidth('bright', { w: 852, h: 393 });
		expect(portrait).toBeCloseTo(393 * HALO_LEVELS.bright, 6);
		expect(portrait).toBeCloseTo(landscape, 6);
	});

	it('is nothing at all when the light is off', () => {
		expect(haloWidth('off', { w: 393, h: 852 })).toBe(0);
	});

	it('is narrower on soft than on bright', () => {
		const viewport = { w: 393, h: 852 };
		expect(haloWidth('soft', viewport)).toBeLessThan(haloWidth('bright', viewport));
	});

	it('survives a viewport that has not been measured yet', () => {
		expect(haloWidth('bright', { w: 0, h: 0 })).toBe(0);
	});
});

describe('maxHaloWidth', () => {
	it('is the widest level, whatever the current one is', () => {
		const viewport = { w: 393, h: 852 };
		expect(maxHaloWidth(viewport)).toBeCloseTo(haloWidth('bright', viewport), 6);
	});

	it('is at least as wide as every level, so nothing placed against it moves', () => {
		const viewport = { w: 393, h: 852 };
		for (const level of ['off', 'soft', 'bright'] as const) {
			expect(maxHaloWidth(viewport)).toBeGreaterThanOrEqual(haloWidth(level, viewport));
		}
	});
});

describe('nextHaloLevel', () => {
	it('cycles off → soft → bright → off', () => {
		expect(nextHaloLevel('off')).toBe('soft');
		expect(nextHaloLevel('soft')).toBe('bright');
		expect(nextHaloLevel('bright')).toBe('off');
	});
});

describe('stageSize', () => {
	it('insets the viewport by the halo on all four sides', () => {
		expect(stageSize({ w: 400, h: 800 }, 30)).toEqual({ w: 340, h: 740 });
	});

	it('is the whole viewport when the halo is closed', () => {
		expect(stageSize({ w: 400, h: 800 }, 0)).toEqual({ w: 400, h: 800 });
	});

	it('never goes negative', () => {
		expect(stageSize({ w: 400, h: 800 }, 500)).toEqual({ w: 0, h: 0 });
	});
});

describe('easeOutCubic', () => {
	it('runs from 0 to 1 and settles at the end', () => {
		expect(easeOutCubic(0)).toBe(0);
		expect(easeOutCubic(1)).toBe(1);
		expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
	});

	it('clamps, so a late frame cannot overshoot', () => {
		expect(easeOutCubic(-1)).toBe(0);
		expect(easeOutCubic(2)).toBe(1);
	});
});

describe('sunRays', () => {
	it('gives none, four and eight — countable at a glance', () => {
		expect(sunRays('off')).toHaveLength(0);
		expect(sunRays('soft')).toHaveLength(4);
		expect(sunRays('bright')).toHaveLength(8);
	});

	it('makes bright rays reach further than soft ones', () => {
		const reach = (level: 'soft' | 'bright') => {
			const [first] = sunRays(level);
			return Math.hypot(first.x2 - 12, first.y2 - 12);
		};
		expect(reach('bright')).toBeGreaterThan(reach('soft'));
	});

	it('starts straight up and spaces the rays evenly', () => {
		const rays = sunRays('soft');
		expect(rays[0].x2).toBeCloseTo(12, 6);
		expect(rays[0].y2).toBeLessThan(12);
		// Four rays a quarter turn apart: up, right, down, left.
		expect(rays[1].y2).toBeCloseTo(12, 6);
		expect(rays[1].x2).toBeGreaterThan(12);
	});

	it('keeps every ray inside the 24×24 icon box', () => {
		for (const level of ['soft', 'bright'] as const) {
			for (const ray of sunRays(level)) {
				for (const value of [ray.x1, ray.y1, ray.x2, ray.y2]) {
					expect(value).toBeGreaterThanOrEqual(1);
					expect(value).toBeLessThanOrEqual(23);
				}
			}
		}
	});
});
