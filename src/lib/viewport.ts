/**
 * Stage geometry. Pure maths, no DOM: everything here is unit-tested.
 *
 * The stage is the area inside the halo. Content space is CSS px on the
 * unzoomed, mirrored picture, with the origin at the stage centre.
 */

export interface Size {
	w: number;
	h: number;
}

/**
 * The scale that makes the stream cover the stage with no empty edge.
 * Returns 1 while the stream size is still unknown.
 */
export function coverScale(stage: Size, stream: Size): number {
	if (stream.w <= 0 || stream.h <= 0) return 1;
	return Math.max(stage.w / stream.w, stage.h / stream.h);
}

/**
 * The size to give the picture element, so it covers the stage exactly.
 * Sized explicitly rather than with `object-fit: cover`, which would crop
 * inside the element's own box and put those edges out of reach of panning.
 */
export function pictureSize(stage: Size, stream: Size): Size {
	if (stream.w <= 0 || stream.h <= 0) return { w: stage.w, h: stage.h };
	const k = coverScale(stage, stream);
	return { w: k * stream.w, h: k * stream.h };
}

/**
 * How many camera pixels land on one physical screen pixel. Below 1 the
 * picture is being enlarged past the sensor's detail — the quality indicator
 * the phase 5 device tests read off the debug overlay.
 */
export function sourcePixelsPerScreenPixel(cover: number, zoom: number, dpr = 1): number {
	if (cover <= 0 || zoom <= 0 || dpr <= 0) return 0;
	return 1 / (cover * zoom * dpr);
}
