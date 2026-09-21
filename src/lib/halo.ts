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
