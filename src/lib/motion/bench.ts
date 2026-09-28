/**
 * Measures what the estimator costs, on whatever machine is running it.
 *
 * Phase 7a put the cost at about 10 ms a frame on a laptop against a 4 ms
 * budget on a phone. Which lever to pull — the analysis size, the sampling
 * step, the fine search radius — is not something a laptop can answer, so
 * this runs the same work on the device itself and reports back.
 *
 * Pure: it generates its own frames and returns numbers. No DOM, no camera.
 */
import { estimateShift } from './estimate';
import { shifted, texture } from './synthetic';

export interface BenchSetting {
	width: number;
	height: number;
	sampleStep: number;
	refineSearchPx: number;
}

export interface BenchResult extends BenchSetting {
	/** Milliseconds for one estimate, averaged. */
	msPerFrame: number;
	/** Largest error among the estimates that would have been accepted. */
	worstAcceptedPx: number;
	/** How often it answered at all. */
	acceptedFraction: number;
}

/** The camera's own conditions: grain, and an exposure that will not sit still. */
const CONDITIONS = { noise: 14, brightness: 9, gain: 1.04 };

/** Movements a nudged stand or a shifting body would produce. */
const SHIFTS: [number, number][] = [
	[4, 3],
	[9, -2],
	[-6, 5],
	[15, 1],
	[-12, -4],
	[2, 8],
	[-3, -9],
	[11, 6]
];

export function benchSettings(): BenchSetting[] {
	const settings: BenchSetting[] = [];
	for (const [width, height] of [
		[128, 96],
		[192, 144],
		[256, 192]
	]) {
		for (const sampleStep of [1, 2]) {
			for (const refineSearchPx of [2, 3]) {
				settings.push({ width, height, sampleStep, refineSearchPx });
			}
		}
	}
	return settings;
}

/**
 * One setting, measured. Accuracy first, so a cheaper setting cannot look
 * good by being wrong, then timing on a frame it has already seen.
 *
 * Timing runs for a fixed stretch rather than a fixed count: a phone and a
 * laptop are an order of magnitude apart, and a count that gives one a steady
 * figure gives the other noise. A first attempt with 15 runs reported a
 * narrower search as slower than a wider one, which is not possible.
 */
export function runSetting(setting: BenchSetting, minimumMs = 150): BenchResult {
	const { width, height, sampleStep, refineSearchPx } = setting;
	const anchor = { x: width / 2, y: height / 2 };
	const options = { anchor, sampleStep, refineSearchPx };

	const accepted: number[] = [];
	let answers = 0;

	const frames = SHIFTS.map(([dx, dy], index) => {
		const reference = texture(width, height, 40 + index);
		return {
			dx,
			dy,
			reference,
			current: shifted(reference, dx, dy, { ...CONDITIONS, seed: 70 + index })
		};
	});

	for (const { reference, current, dx, dy } of frames) {
		const estimate = estimateShift(reference, current, options);
		if (!estimate.accepted) continue;
		answers++;
		accepted.push(Math.hypot(estimate.dx - dx, estimate.dy - dy));
	}

	const warm = frames[0];
	for (let i = 0; i < 5; i++) estimateShift(warm.reference, warm.current, options);

	const started = performance.now();
	let runs = 0;
	do {
		estimateShift(warm.reference, warm.current, options);
		runs++;
	} while (performance.now() - started < minimumMs);
	const msPerFrame = (performance.now() - started) / runs;

	return {
		...setting,
		msPerFrame,
		worstAcceptedPx: accepted.length ? Math.max(...accepted) : Number.NaN,
		acceptedFraction: answers / frames.length
	};
}
