import type { GreyFrame } from '../../src/lib/motion/estimate';

/** Deterministic, so a failure can be reproduced. */
export function makeRandom(seed: number): () => number {
	let state = seed >>> 0 || 1;
	return () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		state >>>= 0;
		return state / 4294967296;
	};
}

/**
 * Something with the texture of a real scene rather than pure noise: a few
 * low-frequency shapes for structure, fine grain on top. Pure noise matches
 * far too well and would flatter the estimator.
 */
export function texture(width: number, height: number, seed = 7): GreyFrame {
	const random = makeRandom(seed);
	const data = new Uint8Array(width * height);
	const waves = Array.from({ length: 6 }, () => ({
		fx: (random() - 0.5) * 0.25,
		fy: (random() - 0.5) * 0.25,
		phase: random() * Math.PI * 2,
		amplitude: 15 + random() * 35
	}));

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let value = 128;
			for (const wave of waves) {
				value += wave.amplitude * Math.sin(wave.fx * x + wave.fy * y + wave.phase);
			}
			value += (random() - 0.5) * 24;
			data[y * width + x] = Math.max(0, Math.min(255, Math.round(value)));
		}
	}
	return { data, width, height };
}

/** Bilinear sample, edge-clamped. */
function sample(frame: GreyFrame, x: number, y: number): number {
	const x0 = Math.max(0, Math.min(frame.width - 1, Math.floor(x)));
	const y0 = Math.max(0, Math.min(frame.height - 1, Math.floor(y)));
	const x1 = Math.min(frame.width - 1, x0 + 1);
	const y1 = Math.min(frame.height - 1, y0 + 1);
	const fx = Math.max(0, Math.min(1, x - x0));
	const fy = Math.max(0, Math.min(1, y - y0));

	const top = frame.data[y0 * frame.width + x0] * (1 - fx) + frame.data[y0 * frame.width + x1] * fx;
	const bottom =
		frame.data[y1 * frame.width + x0] * (1 - fx) + frame.data[y1 * frame.width + x1] * fx;
	return top * (1 - fy) + bottom * fy;
}

export interface ShiftOptions {
	/** Added to every pixel, standing in for an exposure or halo change. */
	brightness?: number;
	/** Multiplies every pixel, before brightness. */
	gain?: number;
	/** Peak-to-peak sensor noise. */
	noise?: number;
	seed?: number;
}

/** The same scene, moved by (dx, dy), as the camera would have seen it next. */
export function shifted(
	frame: GreyFrame,
	dx: number,
	dy: number,
	options: ShiftOptions = {}
): GreyFrame {
	const { brightness = 0, gain = 1, noise = 0, seed = 99 } = options;
	const random = makeRandom(seed);
	const data = new Uint8Array(frame.width * frame.height);

	for (let y = 0; y < frame.height; y++) {
		for (let x = 0; x < frame.width; x++) {
			let value = sample(frame, x - dx, y - dy) * gain + brightness;
			if (noise) value += (random() - 0.5) * noise;
			data[y * frame.width + x] = Math.max(0, Math.min(255, Math.round(value)));
		}
	}
	return { data, width: frame.width, height: frame.height };
}

/**
 * A hand, or whatever is being held: a flat-ish disc laid over the frame. It
 * carries a little texture of its own, so it is something the estimator could
 * latch onto if it were inclined to.
 */
export function occlude(
	frame: GreyFrame,
	cx: number,
	cy: number,
	radius: number,
	phase = 0
): GreyFrame {
	const data = new Uint8Array(frame.data);
	for (let y = 0; y < frame.height; y++) {
		for (let x = 0; x < frame.width; x++) {
			if (Math.hypot(x - cx, y - cy) > radius) continue;
			const grain = 18 * Math.sin(0.55 * (x - phase) + 0.31 * (y - phase));
			data[y * frame.width + x] = Math.max(0, Math.min(255, Math.round(196 + grain)));
		}
	}
	return { data, width: frame.width, height: frame.height };
}

/**
 * What fraction of the blocks the estimator would actually use are covered by
 * a disc. Blocks inside the anchor's exclusion disc are not counted either
 * way: the estimator never looks at them, so they cannot be occluded.
 */
export function coverageOfValidBlocks(
	width: number,
	height: number,
	size: number,
	disc: { x: number; y: number; radius: number },
	exclusionRadius: number
): number {
	let valid = 0;
	let covered = 0;
	for (let row = 0; row < Math.floor(height / size); row++) {
		for (let column = 0; column < Math.floor(width / size); column++) {
			const bx = column * size + size / 2;
			const by = row * size + size / 2;
			if (Math.hypot(bx - width / 2, by - height / 2) < exclusionRadius) continue;
			valid++;
			if (Math.hypot(bx - disc.x, by - disc.y) <= disc.radius) covered++;
		}
	}
	return valid === 0 ? 0 : covered / valid;
}
