import { describe, expect, it } from 'vitest';
import { HALO_LEVELS } from '../../src/lib/config';
import {
	easeOutCubic,
	haloWidth,
	nextHaloStep,
	stageSize,
	sunRays,
	type HaloStep
} from '../../src/lib/halo';
import type { HaloLevel } from '../../src/lib/config';

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

describe('nextHaloStep', () => {
	/** Press the button `n` times from a starting step and list where it went. */
	const walk = (start: HaloStep, presses: number) => {
		let step = start;
		const seen: HaloLevel[] = [];
		for (let i = 0; i < presses; i++) {
			step = nextHaloStep(step);
			seen.push(step.level);
		}
		return seen;
	};

	it('goes up to the top, turns around, and comes back down', () => {
		expect(walk({ level: 'off', rising: true }, 4)).toEqual(['soft', 'bright', 'soft', 'off']);
	});

	it('turns around at the bottom too, so the button never stops working', () => {
		expect(walk({ level: 'off', rising: false }, 2)).toEqual(['soft', 'bright']);
	});

	it('takes one press to come back down from the default', () => {
		expect(nextHaloStep({ level: 'bright', rising: true })).toEqual({
			level: 'soft',
			rising: false
		});
	});

	it('never jumps from the brightest straight to nothing', () => {
		let step: HaloStep = { level: 'off', rising: true };
		let previous: HaloLevel = step.level;
		for (let i = 0; i < 12; i++) {
			step = nextHaloStep(step);
			expect(previous === 'bright' && step.level === 'off').toBe(false);
			expect(previous === 'off' && step.level === 'bright').toBe(false);
			previous = step.level;
		}
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
