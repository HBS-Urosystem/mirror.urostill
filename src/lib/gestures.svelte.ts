import { DOUBLE_TAP_MS, DOUBLE_TAP_SLOP_PX, TAP_MAX_MS, TAP_SLOP_PX } from './config';
import type { Vec } from './viewport';

/**
 * Geometry is reported in stage space: the origin is the centre of the
 * element the gestures are attached to, which is the space the view maths
 * works in. Pan reports the whole displacement since the drag began, and
 * pinch the change in finger distance since they went down, so neither can
 * drift over a long gesture.
 */
export interface GestureHandlers {
	onpanstart(): void;
	onpanmove(total: Vec): void;
	onpanend(): void;
	onpinchstart(): void;
	onpinchmove(midpoint: Vec, ratio: number): void;
	onpinchend(): void;
	ontap(): void;
	ondoubletap(): void;
}

interface Point {
	x: number;
	y: number;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpointOf = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Pointer Events only, on an element with `touch-action: none`.
 * Returns a cleanup function.
 */
export function attachGestures(element: HTMLElement, handlers: GestureHandlers): () => void {
	/** Live pointers, in insertion order; only the first two drive a pinch. */
	const pointers = new Map<number, Point>();
	let phase: 'idle' | 'maybe-tap' | 'panning' | 'pinching' = 'idle';

	let panOrigin: Point = { x: 0, y: 0 };
	let downAt = 0;
	let pinchBaseline = 0;
	let pinchMidpoint: Vec = { x: 0, y: 0 };
	let lastTap: { x: number; y: number; at: number } | null = null;

	/** Stage space: client coordinates relative to the centre of the element. */
	let centre = { x: 0, y: 0 };
	function readCentre() {
		const rect = element.getBoundingClientRect();
		centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}

	function firstTwo(): [Point, Point] | null {
		const live = [...pointers.values()];
		return live.length >= 2 ? [live[0], live[1]] : null;
	}

	function beginPinch() {
		const pair = firstTwo();
		if (!pair) return;
		readCentre();
		pinchBaseline = Math.max(1, distance(pair[0], pair[1]));
		const m = midpointOf(pair[0], pair[1]);
		pinchMidpoint = { x: m.x - centre.x, y: m.y - centre.y };
		phase = 'pinching';
		handlers.onpinchstart();
	}

	function beginPan(from: Point) {
		panOrigin = { ...from };
		phase = 'panning';
		handlers.onpanstart();
	}

	function onPointerDown(event: PointerEvent) {
		try {
			element.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic pointers in tests have nothing to capture.
		}
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (pointers.size === 1) {
			panOrigin = { x: event.clientX, y: event.clientY };
			downAt = event.timeStamp;
			phase = 'maybe-tap';
			return;
		}
		if (pointers.size === 2) {
			if (phase === 'panning') handlers.onpanend();
			beginPinch();
		}
	}

	function onPointerMove(event: PointerEvent) {
		const point = pointers.get(event.pointerId);
		if (!point) return;
		point.x = event.clientX;
		point.y = event.clientY;

		if (phase === 'pinching') {
			const pair = firstTwo();
			if (!pair) return;
			handlers.onpinchmove(pinchMidpoint, distance(pair[0], pair[1]) / pinchBaseline);
			return;
		}

		if (phase === 'maybe-tap') {
			if (distance(point, panOrigin) < TAP_SLOP_PX) return;
			// Pan from where the finger went down, so the picture stays under it.
			beginPan(panOrigin);
		}

		if (phase === 'panning') {
			handlers.onpanmove({ x: point.x - panOrigin.x, y: point.y - panOrigin.y });
		}
	}

	function endTap(event: PointerEvent) {
		const point = { x: event.clientX, y: event.clientY };
		if (event.timeStamp - downAt > TAP_MAX_MS) return;
		if (distance(point, panOrigin) >= TAP_SLOP_PX) return;

		// The single tap fires straight away rather than waiting out the
		// double-tap window: a double tap toggles the controls twice and then
		// asks for them, which lands in the same place without the delay.
		handlers.ontap();
		const previous = lastTap;
		if (
			previous &&
			event.timeStamp - previous.at <= DOUBLE_TAP_MS &&
			distance(point, previous) < DOUBLE_TAP_SLOP_PX
		) {
			lastTap = null;
			handlers.ondoubletap();
			return;
		}
		lastTap = { ...point, at: event.timeStamp };
	}

	function onPointerUp(event: PointerEvent) {
		if (!pointers.delete(event.pointerId)) return;
		try {
			element.releasePointerCapture(event.pointerId);
		} catch {
			// Never captured.
		}

		if (phase === 'maybe-tap') {
			if (event.type === 'pointerup') endTap(event);
			phase = pointers.size > 0 ? phase : 'idle';
			return;
		}

		if (phase === 'pinching') {
			handlers.onpinchend();
			const remaining = [...pointers.values()][0];
			// Handover: carry on as a pan from a fresh baseline, with no jump.
			if (remaining) beginPan(remaining);
			else phase = 'idle';
			return;
		}

		if (phase === 'panning' && pointers.size === 0) {
			handlers.onpanend();
			phase = 'idle';
		}
	}

	/** iOS Safari still fires its own pinch events on top of Pointer Events. */
	const preventLegacyGesture = (event: Event) => event.preventDefault();

	element.addEventListener('pointerdown', onPointerDown);
	element.addEventListener('pointermove', onPointerMove);
	element.addEventListener('pointerup', onPointerUp);
	element.addEventListener('pointercancel', onPointerUp);
	for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
		element.addEventListener(name, preventLegacyGesture);
	}

	return () => {
		element.removeEventListener('pointerdown', onPointerDown);
		element.removeEventListener('pointermove', onPointerMove);
		element.removeEventListener('pointerup', onPointerUp);
		element.removeEventListener('pointercancel', onPointerUp);
		for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
			element.removeEventListener(name, preventLegacyGesture);
		}
		pointers.clear();
	};
}
