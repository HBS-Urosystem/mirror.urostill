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

/** A point in content space: CSS px on the unzoomed picture, origin at the stage centre. */
export interface Vec {
	x: number;
	y: number;
}

/**
 * What the stage is showing. A content point `c` lands on screen, relative to
 * the stage centre, at `p = s·c + t` — which is `translate3d(t) scale(s)`.
 */
export interface View {
	s: number;
	t: Vec;
}

export function clampZoom(s: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, s));
}

/** How far the picture may be moved before an empty edge would show. */
export function translationBound(s: number, picture: Size, stage: Size): Vec {
	return {
		x: Math.max(0, (s * picture.w - stage.w) / 2),
		y: Math.max(0, (s * picture.h - stage.h) / 2)
	};
}

export function clampTranslation(t: Vec, s: number, picture: Size, stage: Size): Vec {
	const bound = translationBound(s, picture, stage);
	return {
		x: Math.min(bound.x, Math.max(-bound.x, t.x)),
		y: Math.min(bound.y, Math.max(-bound.y, t.y))
	};
}

/** `delta` is the whole displacement since the drag began, not the last step. */
export function pan(start: View, delta: Vec, picture: Size, stage: Size): View {
	const t = { x: start.t.x + delta.x, y: start.t.y + delta.y };
	return { s: start.s, t: clampTranslation(t, start.s, picture, stage) };
}

/**
 * Zoom about `midpoint`, keeping the content point under it where it is.
 * `start` is the view when the fingers went down and `ratio` the change in
 * their distance since, so the picture cannot drift over a long pinch.
 */
export function pinch(
	start: View,
	midpoint: Vec,
	ratio: number,
	picture: Size,
	stage: Size,
	limits: { min: number; max: number }
): View {
	const s = clampZoom(start.s * ratio, limits.min, limits.max);
	const factor = s / start.s;
	const t = {
		x: midpoint.x - factor * (midpoint.x - start.t.x),
		y: midpoint.y - factor * (midpoint.y - start.t.y)
	};
	return { s, t: clampTranslation(t, s, picture, stage) };
}

/** The content point currently at the stage centre. */
export function centreContentPoint(view: View): Vec {
	if (view.s <= 0) return { x: 0, y: 0 };
	return { x: -view.t.x / view.s, y: -view.t.y / view.s };
}

/**
 * Normalised picture coordinates, 0–1 across the mirrored picture. The view is
 * stored this way so it survives a resize, a rotation or a change of stream
 * size, none of which should move what the user put in the middle.
 */
export function toNormalised(c: Vec, picture: Size): Vec {
	if (picture.w <= 0 || picture.h <= 0) return { x: 0.5, y: 0.5 };
	return { x: c.x / picture.w + 0.5, y: c.y / picture.h + 0.5 };
}

export function fromNormalised(u: Vec, picture: Size): Vec {
	return { x: (u.x - 0.5) * picture.w, y: (u.y - 0.5) * picture.h };
}

/** The translation that puts normalised point `u` at the stage centre. */
export function translationForCentre(u: Vec, s: number, picture: Size, stage: Size): Vec {
	const c = fromNormalised(u, picture);
	return clampTranslation({ x: -s * c.x, y: -s * c.y }, s, picture, stage);
}
