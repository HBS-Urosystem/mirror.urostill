import {
	DOUBLE_TAP_MS,
	DOUBLE_TAP_SLOP_PX,
	KEY_PAN_FAST,
	KEY_PAN_STEP_PX,
	KEY_ZOOM_STEP,
	TAP_MAX_MS,
	TAP_SLOP_PX,
	WHEEL_LINE_PX,
	WHEEL_NOTCH_PX,
	WHEEL_PAGE_PX,
	WHEEL_PINCH_FACTOR,
	WHEEL_ZOOM_STEP
} from './config';
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
	/** Double tap, `0`, or the zoom readout: back to 1×. */
	onreset(): void;
	/** Wheel, trackpad pinch or `+`/`-`: zoom by `ratio` about `at`. */
	onzoomat(at: Vec, ratio: number): void;
	/** Arrow keys: move the picture, the same way a drag would. */
	onnudge(delta: Vec): void;
	/** Escape, when the browser is not holding fullscreen. */
	onleave(): void;
	/** A mouse moved over the stage; on a desktop that is enough to want the controls. */
	onhover(): void;
}

/**
 * Wheel deltas arrive in pixels, lines or pages depending on the browser and
 * the device. Everything downstream works in pixels.
 */
export function normaliseWheelDelta(
	deltaY: number,
	deltaMode: number,
	linePx = WHEEL_LINE_PX,
	pagePx = WHEEL_PAGE_PX
): number {
	if (deltaMode === 1) return deltaY * linePx;
	if (deltaMode === 2) return deltaY * pagePx;
	return deltaY;
}

/**
 * The zoom ratio for one wheel event. `ctrlKey` means a trackpad pinch — both
 * macOS and Windows report it that way — which needs a much finer factor than
 * a mouse wheel's discrete notches. Scrolling up zooms in, as everywhere else.
 */
export function wheelZoomRatio(
	deltaPx: number,
	ctrlKey: boolean,
	step = WHEEL_ZOOM_STEP,
	pinchFactor = WHEEL_PINCH_FACTOR,
	notchPx = WHEEL_NOTCH_PX
): number {
	if (ctrlKey) return Math.exp(-deltaPx * pinchFactor);
	return step ** (-deltaPx / notchPx);
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
		if (!point) {
			// Hovering. On a desktop, moving the mouse is enough to ask for the controls.
			if (event.pointerType === 'mouse' && pointers.size === 0) handlers.onhover();
			return;
		}
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
			// Past the slop: this is a drag, not a click.
			element.style.cursor = 'grabbing';
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
			handlers.onreset();
			return;
		}
		lastTap = { ...point, at: event.timeStamp };
	}

	function onPointerUp(event: PointerEvent) {
		if (!pointers.delete(event.pointerId)) return;
		if (pointers.size === 0) element.style.cursor = '';
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

	function onWheel(event: WheelEvent) {
		// Always: the page has nothing to scroll, and a trackpad pinch would
		// otherwise zoom the page itself.
		event.preventDefault();
		readCentre();
		const ratio = wheelZoomRatio(normaliseWheelDelta(event.deltaY, event.deltaMode), event.ctrlKey);
		if (ratio === 1) return;
		handlers.onzoomat({ x: event.clientX - centre.x, y: event.clientY - centre.y }, ratio);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const step = KEY_PAN_STEP_PX * (event.shiftKey ? KEY_PAN_FAST : 1);

		switch (event.key) {
			case 'ArrowLeft':
				handlers.onnudge({ x: step, y: 0 });
				break;
			case 'ArrowRight':
				handlers.onnudge({ x: -step, y: 0 });
				break;
			case 'ArrowUp':
				handlers.onnudge({ x: 0, y: step });
				break;
			case 'ArrowDown':
				handlers.onnudge({ x: 0, y: -step });
				break;
			case '+':
			case '=':
				handlers.onzoomat({ x: 0, y: 0 }, KEY_ZOOM_STEP);
				break;
			case '-':
				handlers.onzoomat({ x: 0, y: 0 }, 1 / KEY_ZOOM_STEP);
				break;
			case '0':
				handlers.onreset();
				break;
			case 'Escape':
				// Let the browser have the first Escape to leave fullscreen.
				if (document.fullscreenElement) return;
				handlers.onleave();
				break;
			default:
				return;
		}
		event.preventDefault();
	}

	/** iOS Safari still fires its own pinch events on top of Pointer Events. */
	const preventLegacyGesture = (event: Event) => event.preventDefault();

	element.addEventListener('pointerdown', onPointerDown);
	element.addEventListener('pointermove', onPointerMove);
	element.addEventListener('pointerup', onPointerUp);
	element.addEventListener('pointercancel', onPointerUp);
	element.addEventListener('wheel', onWheel, { passive: false });
	element.addEventListener('keydown', onKeyDown);
	for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
		element.addEventListener(name, preventLegacyGesture);
	}

	return () => {
		element.removeEventListener('pointerdown', onPointerDown);
		element.removeEventListener('pointermove', onPointerMove);
		element.removeEventListener('pointerup', onPointerUp);
		element.removeEventListener('pointercancel', onPointerUp);
		element.removeEventListener('wheel', onWheel);
		element.removeEventListener('keydown', onKeyDown);
		for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
			element.removeEventListener(name, preventLegacyGesture);
		}
		pointers.clear();
	};
}
