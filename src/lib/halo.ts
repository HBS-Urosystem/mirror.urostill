/**
 * The halo is the light source: a pure white frame around the stage, as wide
 * as the chosen level. Pure maths, no DOM.
 */
import { HALO_LEVELS, HALO_ORDER, type HaloLevel } from './config';
import type { Size } from './viewport';

/** Halo width in CSS px. Levels are a fraction of the short side. */
export function haloWidth(level: HaloLevel, viewport: Size): number {
	const short = Math.max(0, Math.min(viewport.w, viewport.h));
	return HALO_LEVELS[level] * short;
}

export function nextHaloLevel(level: HaloLevel): HaloLevel {
	const at = HALO_ORDER.indexOf(level);
	return HALO_ORDER[(at + 1) % HALO_ORDER.length];
}

/** The stage is the viewport inset by the halo on all sides. */
export function stageSize(viewport: Size, halo: number): Size {
	return {
		w: Math.max(0, viewport.w - 2 * halo),
		h: Math.max(0, viewport.h - 2 * halo)
	};
}

/** Light arriving: quick at first, settling at the end. */
export function easeOutCubic(t: number): number {
	const clamped = Math.min(1, Math.max(0, t));
	return 1 - (1 - clamped) ** 3;
}

export interface Ray {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/**
 * The light button has to show its own level, not just say it in a label.
 * Countable rays do that without widening the pill or adding copy: none,
 * four short, eight long. Coordinates are for a 24×24 icon.
 */
export function sunRays(level: HaloLevel): Ray[] {
	const spec = {
		off: null,
		soft: { count: 4, from: 6.8, to: 9 },
		bright: { count: 8, from: 6.8, to: 10.5 }
	}[level];
	if (!spec) return [];

	const round = (n: number) => Math.round(n * 100) / 100;
	return Array.from({ length: spec.count }, (_, i) => {
		const angle = (i * 2 * Math.PI) / spec.count - Math.PI / 2;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		return {
			x1: round(12 + spec.from * cos),
			y1: round(12 + spec.from * sin),
			x2: round(12 + spec.to * cos),
			y2: round(12 + spec.to * sin)
		};
	});
}
