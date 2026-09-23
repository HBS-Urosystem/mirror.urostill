/**
 * How far the whole scene moved between two frames.
 *
 * This is deliberately **not** object tracking. The user's hand, and whatever
 * they are holding, will move through the middle of the picture; anything that
 * follows the patch around the anchor would latch onto the hand and drag the
 * view with it. So the shift is measured from blocks spread across the whole
 * frame, with a disc around the anchor left out, and the answer is the median
 * — a hand crossing the frame is outvoted rather than followed.
 *
 * Pure maths: no DOM, no pixels read from anywhere. The caller hands in two
 * greyscale buffers and gets a vector back.
 */
import {
	MOTION_BLOCK_PX,
	MOTION_COARSE_BLOCK_PX,
	MOTION_COARSE_SEARCH_PX,
	MOTION_EXCLUSION_FRACTION,
	MOTION_INLIER_PX,
	MOTION_LEVELS,
	MOTION_MIN_BLOCKS,
	MOTION_MIN_CONFIDENCE,
	MOTION_MIN_VARIANCE,
	MOTION_REFINE_SEARCH_PX,
	MOTION_SAMPLE_STEP
} from '../config';

/** One byte per pixel, row-major, no padding. */
export interface GreyFrame {
	data: Uint8Array;
	width: number;
	height: number;
}

export interface Shift {
	/** Analysis pixels the scene moved between the two frames. */
	dx: number;
	dy: number;
}

export interface Estimate extends Shift {
	/** Blocks that agreed with the median, over blocks that were worth matching. */
	confidence: number;
	validBlocks: number;
	inliers: number;
	/** Whether the integrator should use this at all. */
	accepted: boolean;
}

export interface EstimateOptions {
	/** Anchor in analysis-frame coordinates. Blocks around it are left out. */
	anchor?: { x: number; y: number };
	/** Where the scene was last seen, so motion can accumulate past one search window. */
	prediction?: Shift;
	/** 1 takes every pixel of a block, 2 every second one in each direction. */
	sampleStep?: number;
}

/** Summed areas, for block means and variances in constant time. */
interface Integrals {
	sum: Float64Array;
	sumSq: Float64Array;
	stride: number;
}

function integrals(frame: GreyFrame): Integrals {
	const { data, width, height } = frame;
	const stride = width + 1;
	const sum = new Float64Array(stride * (height + 1));
	const sumSq = new Float64Array(stride * (height + 1));

	for (let y = 0; y < height; y++) {
		let rowSum = 0;
		let rowSqSum = 0;
		for (let x = 0; x < width; x++) {
			const value = data[y * width + x];
			rowSum += value;
			rowSqSum += value * value;
			sum[(y + 1) * stride + x + 1] = sum[y * stride + x + 1] + rowSum;
			sumSq[(y + 1) * stride + x + 1] = sumSq[y * stride + x + 1] + rowSqSum;
		}
	}
	return { sum, sumSq, stride };
}

function areaSum(table: Float64Array, stride: number, x: number, y: number, size: number): number {
	const top = y * stride + x;
	const bottom = (y + size) * stride + x;
	return table[bottom + size] - table[bottom] - table[top + size] + table[top];
}

/** Box-averaged half-size copy. Odd edges are dropped, which costs nothing here. */
export function downscaleHalf(frame: GreyFrame): GreyFrame {
	const width = frame.width >> 1;
	const height = frame.height >> 1;
	const data = new Uint8Array(width * height);

	for (let y = 0; y < height; y++) {
		const rowA = 2 * y * frame.width;
		const rowB = rowA + frame.width;
		for (let x = 0; x < width; x++) {
			const at = 2 * x;
			data[y * width + x] =
				(frame.data[rowA + at] +
					frame.data[rowA + at + 1] +
					frame.data[rowB + at] +
					frame.data[rowB + at + 1] +
					2) >>
				2;
		}
	}
	return { data, width, height };
}

export function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = sorted.length >> 1;
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * A minimum between three costs is somewhere between the samples. Fitting a
 * parabola to them puts it there, which is most of what sub-pixel accuracy is.
 */
function parabolicOffset(before: number, at: number, after: number): number {
	const curvature = before - 2 * at + after;
	if (curvature <= 0) return 0;
	const offset = (0.5 * (before - after)) / curvature;
	return Math.max(-0.5, Math.min(0.5, offset));
}

interface BlockResult extends Shift {
	cost: number;
}

/**
 * Zero-mean sum of absolute differences: each patch has its own mean taken out
 * first, so a change of exposure — or of the halo brightness reflected back
 * into the lens — costs nothing.
 *
 * `limit` stops the sum as soon as it cannot win. That makes the search much
 * cheaper, but it returns a partial figure, so anything that needs the real
 * cost — the sub-pixel fit below — must ask with no limit.
 */
function blockCost(
	reference: GreyFrame,
	current: GreyFrame,
	curIntegrals: Integrals,
	bx: number,
	by: number,
	cx: number,
	cy: number,
	size: number,
	refMean: number,
	limit: number,
	step: number
): number {
	if (cx < 0 || cy < 0 || cx + size > current.width || cy + size > current.height) {
		return Infinity;
	}
	const shiftMean =
		areaSum(curIntegrals.sum, curIntegrals.stride, cx, cy, size) / (size * size) - refMean;

	// The means come from the whole block either way, so they stay the better
	// estimate even when only some of its pixels are compared.
	let cost = 0;
	for (let row = 0; row < size; row += step) {
		const refRow = (by + row) * reference.width + bx;
		const curRow = (cy + row) * current.width + cx;
		for (let column = 0; column < size; column += step) {
			cost += Math.abs(current.data[curRow + column] - reference.data[refRow + column] - shiftMean);
		}
		if (cost >= limit) return cost;
	}
	return cost;
}

function matchBlock(
	reference: GreyFrame,
	current: GreyFrame,
	refIntegrals: Integrals,
	curIntegrals: Integrals,
	bx: number,
	by: number,
	size: number,
	predict: Shift,
	radius: number,
	subPixel: boolean,
	step: number
): BlockResult | null {
	const refMean = areaSum(refIntegrals.sum, refIntegrals.stride, bx, by, size) / (size * size);
	const baseX = Math.round(predict.dx);
	const baseY = Math.round(predict.dy);

	let bestCost = Infinity;
	let bestX = 0;
	let bestY = 0;

	for (let oy = -radius; oy <= radius; oy++) {
		for (let ox = -radius; ox <= radius; ox++) {
			const cost = blockCost(
				reference,
				current,
				curIntegrals,
				bx,
				by,
				bx + baseX + ox,
				by + baseY + oy,
				size,
				refMean,
				bestCost,
				step
			);
			if (cost < bestCost) {
				bestCost = cost;
				bestX = ox;
				bestY = oy;
			}
		}
	}

	if (!Number.isFinite(bestCost)) return null;

	let dx = baseX + bestX;
	let dy = baseY + bestY;

	if (subPixel) {
		const cx = bx + dx;
		const cy = by + dy;
		const exact = (atX: number, atY: number) =>
			blockCost(reference, current, curIntegrals, bx, by, atX, atY, size, refMean, Infinity, step);

		const centre = exact(cx, cy);
		const left = exact(cx - 1, cy);
		const right = exact(cx + 1, cy);
		if (Number.isFinite(left) && Number.isFinite(right)) {
			dx += parabolicOffset(left, centre, right);
		}
		const up = exact(cx, cy - 1);
		const down = exact(cx, cy + 1);
		if (Number.isFinite(up) && Number.isFinite(down)) {
			dy += parabolicOffset(up, centre, down);
		}
	}

	return { dx, dy, cost: bestCost };
}

interface LevelResult extends Shift {
	blocks: Shift[];
}

function estimateLevel(
	reference: GreyFrame,
	current: GreyFrame,
	size: number,
	radius: number,
	predict: Shift,
	anchor: { x: number; y: number } | undefined,
	exclusionRadius: number,
	subPixel: boolean,
	step: number
): LevelResult {
	const refIntegrals = integrals(reference);
	const curIntegrals = integrals(current);
	const across = Math.floor(reference.width / size);
	const down = Math.floor(reference.height / size);
	const area = size * size;
	const blocks: Shift[] = [];

	for (let row = 0; row < down; row++) {
		for (let column = 0; column < across; column++) {
			const bx = column * size;
			const by = row * size;

			if (anchor) {
				const centreX = bx + size / 2;
				const centreY = by + size / 2;
				if (Math.hypot(centreX - anchor.x, centreY - anchor.y) < exclusionRadius) continue;
			}

			// A flat block matches everywhere equally, which is the same as not
			// matching at all, and it would vote for whatever the prediction was.
			const sum = areaSum(refIntegrals.sum, refIntegrals.stride, bx, by, size);
			const sumSq = areaSum(refIntegrals.sumSq, refIntegrals.stride, bx, by, size);
			const mean = sum / area;
			if (sumSq / area - mean * mean < MOTION_MIN_VARIANCE) continue;

			const match = matchBlock(
				reference,
				current,
				refIntegrals,
				curIntegrals,
				bx,
				by,
				size,
				predict,
				radius,
				subPixel,
				step
			);
			if (match) blocks.push({ dx: match.dx, dy: match.dy });
		}
	}

	return {
		dx: median(blocks.map((block) => block.dx)),
		dy: median(blocks.map((block) => block.dy)),
		blocks
	};
}

/**
 * The shift from `reference` to `current`, in analysis pixels. A feature at
 * `p` in the reference is at `p + (dx, dy)` in the current frame.
 *
 * Coarse levels find the reach, the finest one finds the precision. The
 * reference frame is always the one captured when the user last stopped
 * interacting, never the previous frame, so error cannot accumulate as drift.
 */
export function estimateShift(
	reference: GreyFrame,
	current: GreyFrame,
	options: EstimateOptions = {}
): Estimate {
	const pyramidReference: GreyFrame[] = [reference];
	const pyramidCurrent: GreyFrame[] = [current];
	for (let level = 1; level < MOTION_LEVELS; level++) {
		pyramidReference.push(downscaleHalf(pyramidReference[level - 1]));
		pyramidCurrent.push(downscaleHalf(pyramidCurrent[level - 1]));
	}

	const shortSide = Math.min(reference.width, reference.height);
	const exclusion = MOTION_EXCLUSION_FRACTION * shortSide;

	const coarsest = MOTION_LEVELS - 1;
	const scale = 1 << coarsest;
	let carried: Shift = {
		dx: (options.prediction?.dx ?? 0) / scale,
		dy: (options.prediction?.dy ?? 0) / scale
	};
	let finest: LevelResult | null = null;

	for (let level = coarsest; level >= 0; level--) {
		const atLevel = 1 << level;
		const result = estimateLevel(
			pyramidReference[level],
			pyramidCurrent[level],
			level === 0 ? MOTION_BLOCK_PX : MOTION_COARSE_BLOCK_PX,
			level === coarsest ? MOTION_COARSE_SEARCH_PX : MOTION_REFINE_SEARCH_PX,
			carried,
			options.anchor && { x: options.anchor.x / atLevel, y: options.anchor.y / atLevel },
			exclusion / atLevel,
			level === 0,
			// Coarse levels have small blocks already; thinning them would leave
			// too few samples to match on.
			level === 0 ? (options.sampleStep ?? MOTION_SAMPLE_STEP) : 1
		);

		if (result.blocks.length === 0) {
			// Nothing to go on at this level; carry the prediction down untouched.
			carried = { dx: carried.dx * 2, dy: carried.dy * 2 };
			continue;
		}

		finest = result;
		carried = level === 0 ? result : { dx: result.dx * 2, dy: result.dy * 2 };
	}

	if (!finest || finest.blocks.length === 0) {
		return {
			dx: options.prediction?.dx ?? 0,
			dy: options.prediction?.dy ?? 0,
			confidence: 0,
			validBlocks: 0,
			inliers: 0,
			accepted: false
		};
	}

	const { dx, dy, blocks } = finest;
	const inliers = blocks.filter(
		(block) => Math.hypot(block.dx - dx, block.dy - dy) <= MOTION_INLIER_PX
	).length;
	const confidence = inliers / blocks.length;

	return {
		dx,
		dy,
		confidence,
		validBlocks: blocks.length,
		inliers,
		accepted: confidence >= MOTION_MIN_CONFIDENCE && blocks.length >= MOTION_MIN_BLOCKS
	};
}
