import { describe, expect, it } from 'vitest';
import { MOTION_BLOCK_PX, MOTION_EXCLUSION_FRACTION } from '../../src/lib/config';
import { downscaleHalf, estimateShift, median } from '../../src/lib/motion/estimate';
import { coverageOfValidBlocks, occlude, shifted, texture } from './synthetic';

const W = 192;
const H = 144;
const CENTRE = { x: W / 2, y: H / 2 };

/** The conditions the camera will actually be in: grain and a changing exposure. */
const REALISTIC = { noise: 14, brightness: 9, gain: 1.04 };

/** Twenty movements, so a 90 % pass rate is something a run can actually show. */
const SHIFTS: [number, number][] = [
	[4, 3],
	[9, -2],
	[-6, 5],
	[15, 1],
	[-12, -4],
	[2, 8],
	[-3, -9],
	[11, 6],
	[-18, 2],
	[7, -7],
	[0, 4],
	[-1, -1],
	[20, -5],
	[-14, 9],
	[5, 12],
	[-9, -11],
	[13, 3],
	[-21, 0],
	[8, -14],
	[-4, 17]
];

describe('median', () => {
	it('takes the middle of an odd count and the mean of an even one', () => {
		expect(median([3, 1, 2])).toBe(2);
		expect(median([4, 1, 3, 2])).toBe(2.5);
	});

	it('is unmoved by a minority of wild values — the whole point of using it', () => {
		expect(median([1, 1, 1, 1, 1, 900, 900])).toBe(1);
	});

	it('is 0 for nothing at all', () => {
		expect(median([])).toBe(0);
	});
});

describe('downscaleHalf', () => {
	it('halves both sides and averages each 2×2', () => {
		const frame = { data: new Uint8Array([0, 10, 20, 30]), width: 2, height: 2 };
		const half = downscaleHalf(frame);
		expect(half.width).toBe(1);
		expect(half.height).toBe(1);
		expect(half.data[0]).toBe(15);
	});
});

describe('estimateShift', () => {
	it('recovers a still scene as no movement at all', () => {
		const reference = texture(W, H);
		const current = shifted(reference, 0, 0, REALISTIC);
		const estimate = estimateShift(reference, current, { anchor: CENTRE });

		expect(Math.hypot(estimate.dx, estimate.dy)).toBeLessThanOrEqual(0.5);
		expect(estimate.accepted).toBe(true);
	});

	it('recovers shifts from 0 to 30 px, through noise and an exposure change', () => {
		const offsets: [number, number][] = [];
		for (const dx of [0, 0.5, 1.25, 3, 7.5, 12, 18, 24, 30, -2.5, -9, -21, -30]) {
			for (const dy of [0, 1.5, -4.25, 11, -17]) offsets.push([dx, dy]);
		}

		const errors = offsets.map(([dx, dy], index) => {
			const reference = texture(W, H, 7 + index);
			const current = shifted(reference, dx, dy, { ...REALISTIC, seed: 31 + index });
			const estimate = estimateShift(reference, current, { anchor: CENTRE });
			return Math.hypot(estimate.dx - dx, estimate.dy - dy);
		});

		const within = errors.filter((error) => error <= 0.5).length / errors.length;
		const worst = Math.max(...errors);
		console.log(
			`shift accuracy: ${(within * 100).toFixed(1)} % within 0.5 px, worst ${worst.toFixed(2)} px, over ${errors.length} cases`
		);
		expect(within).toBeGreaterThanOrEqual(0.9);
	});

	it('holds its accuracy while a hand covers up to 40 % of the usable blocks', () => {
		const exclusion = MOTION_EXCLUSION_FRACTION * H;
		const report: string[] = [];
		const results: { coverage: number; within: number }[] = [];

		for (const radius of [30, 42, 51, 59, 63, 66, 70]) {
			const coverage = coverageOfValidBlocks(
				W,
				H,
				MOTION_BLOCK_PX,
				{ x: CENTRE.x, y: CENTRE.y, radius },
				exclusion
			);

			const runs = SHIFTS.map(([dx, dy], index) => {
				const reference = texture(W, H, 40 + index);
				const moved = shifted(reference, dx, dy, { ...REALISTIC, seed: 70 + index });
				// The hand is in the current frame only, over the middle.
				const current = occlude(moved, CENTRE.x, CENTRE.y, radius);
				const estimate = estimateShift(reference, current, { anchor: CENTRE });
				return {
					accepted: estimate.accepted,
					error: Math.hypot(estimate.dx - dx, estimate.dy - dy)
				};
			});

			// Only accepted estimates can move the view; a rejected one holds the
			// last good value, which is a pause rather than a mistake.
			const accepted = runs.filter((run) => run.accepted);
			const rate = accepted.length / runs.length;
			const within = accepted.length
				? accepted.filter((run) => run.error <= 0.5).length / accepted.length
				: 1;

			report.push(
				accepted.length
					? `${(coverage * 100).toFixed(0)} % covered → ${(rate * 100).toFixed(0)} % accepted, ` +
							`of those ${(within * 100).toFixed(0)} % within 0.5 px ` +
							`(worst ${Math.max(...accepted.map((run) => run.error)).toFixed(2)})`
					: `${(coverage * 100).toFixed(0)} % covered → nothing accepted, tracking pauses`
			);
			results.push({ coverage, within });
		}

		console.log(`occluder sweep: ${report.join(' | ')}`);
		for (const { coverage, within } of results) {
			if (coverage <= 0.4) expect(within).toBeGreaterThanOrEqual(0.9);
		}
	});

	it('follows the scene, not the hand crossing it', () => {
		// The scene barely moves; the hand sweeps across it. Anything that
		// tracked the hand would report the hand's motion instead.
		const reference = texture(W, H, 5);
		const still = shifted(reference, 1, 0, REALISTIC);

		for (const handX of [40, 70, 96, 130, 160]) {
			const current = occlude(still, handX, CENTRE.y, 30, handX);
			const estimate = estimateShift(reference, current, { anchor: CENTRE });
			expect(Math.abs(estimate.dx - 1)).toBeLessThanOrEqual(0.5);
			expect(Math.abs(estimate.dy)).toBeLessThanOrEqual(0.5);
		}
	});

	it('accumulates beyond one search window when told where the scene was', () => {
		const reference = texture(W, H, 3);
		// Further than the pyramid can reach in one go from a standing start.
		const current = shifted(reference, 46, -38, REALISTIC);

		const blind = estimateShift(reference, current, { anchor: CENTRE });
		expect(Math.hypot(blind.dx - 46, blind.dy + 38)).toBeGreaterThan(1);

		const guided = estimateShift(reference, current, {
			anchor: CENTRE,
			prediction: { dx: 40, dy: -32 }
		});
		expect(Math.hypot(guided.dx - 46, guided.dy + 38)).toBeLessThanOrEqual(0.5);
	});

	it('says so rather than guessing when the frame has nothing to match', () => {
		const flat: { data: Uint8Array; width: number; height: number } = {
			data: new Uint8Array(W * H).fill(128),
			width: W,
			height: H
		};
		const estimate = estimateShift(flat, flat, { anchor: CENTRE });
		expect(estimate.accepted).toBe(false);
		expect(estimate.validBlocks).toBeLessThan(8);
	});

	it('reports what it costs, at both sampling steps', () => {
		const cases = [4, 9, -6, 15, -12, 21, -19].map((dx, index) => {
			const reference = texture(W, H, 11 + index);
			return {
				dx,
				dy: -4,
				reference,
				current: shifted(reference, dx, -4, { ...REALISTIC, seed: 3 + index })
			};
		});

		for (const sampleStep of [1, 2]) {
			const errors = cases.map(({ reference, current, dx, dy }) => {
				const estimate = estimateShift(reference, current, { anchor: CENTRE, sampleStep });
				return Math.hypot(estimate.dx - dx, estimate.dy - dy);
			});

			// Warm, then measure.
			estimateShift(cases[0].reference, cases[0].current, { anchor: CENTRE, sampleStep });
			const started = performance.now();
			const runs = 40;
			for (let i = 0; i < runs; i++) {
				estimateShift(cases[0].reference, cases[0].current, { anchor: CENTRE, sampleStep });
			}
			const each = (performance.now() - started) / runs;

			console.log(
				`sampleStep ${sampleStep}: ${each.toFixed(2)} ms per frame at ${W}×${H} (Node, this Mac), ` +
					`worst error ${Math.max(...errors).toFixed(2)} px`
			);
			expect(Math.max(...errors)).toBeLessThanOrEqual(0.5);
		}
	});
});
