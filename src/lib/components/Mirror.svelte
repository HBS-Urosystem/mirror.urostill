<script lang="ts">
	import ControlPill from './ControlPill.svelte';
	import DebugOverlay from './DebugOverlay.svelte';
	import Crosshair from '$lib/icons/Crosshair.svelte';
	import type { UpgradeState } from '$lib/camera.svelte';
	import {
		CROSSHAIR_FADE_MS,
		CROSSHAIR_HOLD_MS,
		HALO_DEFAULT,
		HALO_OPEN_MS,
		PILL_AUTOHIDE_MS,
		PILL_FADE_MS,
		ZOOM_MAX,
		ZOOM_MIN,
		ZOOM_START,
		type HaloLevel
	} from '$lib/config';
	import { attachGestures, type GestureHandlers } from '$lib/gestures.svelte';
	import { easeOutCubic, haloWidth, nextHaloStep, stageSize } from '$lib/halo';
	import type { Strings } from '$lib/i18n';
	import {
		anchorPosition,
		centreContentPoint,
		coverScale,
		pan,
		pictureSize,
		pinch,
		toNormalised,
		translationForCentre,
		type Vec,
		type View
	} from '$lib/viewport';
	import type { WakeLockStatus } from '$lib/wakelock.svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { fade } from 'svelte/transition';

	let {
		t,
		stream,
		debug = false,
		upgradeState,
		wakeLockStatus,
		onexit,
		onplayfail,
		onvideoready
	}: {
		t: Strings;
		stream: MediaStream | null;
		debug?: boolean;
		upgradeState: UpgradeState;
		wakeLockStatus: WakeLockStatus;
		onexit: () => void;
		onplayfail: (error: unknown) => void;
		/** The picture is running; the resolution probe can start. */
		onvideoready: (video: HTMLVideoElement) => void;
	} = $props();

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	let stageElement = $state<HTMLElement | null>(null);
	let video = $state<HTMLVideoElement | null>(null);
	let rootW = $state(0);
	let rootH = $state(0);
	let streamW = $state(0);
	let streamH = $state(0);

	let level = $state<HaloLevel>(HALO_DEFAULT);
	/** The direction the light is being taken, so the button can turn around at the ends. */
	let rising = $state(true);
	/** 0 at the edge of the screen, 1 at full width. The one choreographed motion. */
	let openProgress = $state(0);

	let zoom = $state(ZOOM_START);
	/**
	 * The picture point held at the stage centre, in normalised picture
	 * coordinates — so a resize, a rotation or a change of stream size cannot
	 * move what the user put in the middle.
	 */
	let centre = $state<Vec>({ x: 0.5, y: 0.5 });
	let controlsVisible = $state(true);
	let crosshairVisible = $state(false);
	/** Set while a drag is in progress, for the cursor. */
	let dragging = $state(false);

	const limits = { min: ZOOM_MIN, max: ZOOM_MAX };

	const viewport = $derived({ w: rootW, h: rootH });
	const halo = $derived(haloWidth(level, viewport) * openProgress);
	/**
	 * Computed rather than measured. A ResizeObserver reports the stage a frame
	 * late, which during the halo opening would leave the picture briefly too
	 * small for it — the one thing that must never happen.
	 */
	const stage = $derived(stageSize(viewport, halo));
	const source = $derived({ w: streamW, h: streamH });
	const picture = $derived(pictureSize(stage, source));
	const cover = $derived(coverScale(stage, source));
	const translation = $derived(translationForCentre(centre, zoom, picture, stage));
	/**
	 * `centre` is the anchor: the content point held in the middle, re-derived
	 * from the view after every interaction and stored normalised, so a resize,
	 * a rotation or a new stream size cannot move it. This is where it actually
	 * lands — the stage centre unless clamping has pushed it off.
	 */
	const anchor = $derived(anchorPosition(centre, zoom, picture, stage));

	/** The view when the gesture began. Every step works from it, never from the last frame. */
	let gestureStart: View | null = null;

	function applyView(next: View) {
		zoom = next.s;
		centre = toNormalised(centreContentPoint(next), picture);
	}

	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	function keepControlsVisible() {
		controlsVisible = true;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => (controlsVisible = false), PILL_AUTOHIDE_MS);
	}
	function toggleControls() {
		if (!controlsVisible) return keepControlsVisible();
		clearTimeout(hideTimer);
		controlsVisible = false;
	}
	/** A gesture keeps the controls up, but never summons them. */
	function noteInteraction() {
		if (controlsVisible) keepControlsVisible();
	}

	let crosshairTimer: ReturnType<typeof setTimeout> | undefined;
	/**
	 * The crosshair marks what the mirror will follow from phase 7. It shows
	 * while the user is choosing that, from any input, and holds afterwards.
	 */
	function showCrosshair() {
		crosshairVisible = true;
		clearTimeout(crosshairTimer);
		crosshairTimer = setTimeout(() => (crosshairVisible = false), CROSSHAIR_HOLD_MS);
	}

	/** Zoom about a point, from the view as it is now. */
	function zoomAt(at: Vec, ratio: number) {
		applyView(pinch({ s: zoom, t: translation }, at, ratio, picture, stage, limits));
		showCrosshair();
		noteInteraction();
	}

	function reset() {
		zoom = ZOOM_START;
		showCrosshair();
		keepControlsVisible();
	}

	const handlers: GestureHandlers = {
		onpanstart() {
			noteInteraction();
			dragging = true;
			gestureStart = { s: zoom, t: translation };
		},
		onpanmove(total) {
			if (!gestureStart) return;
			applyView(pan(gestureStart, total, picture, stage));
			showCrosshair();
		},
		onpanend() {
			dragging = false;
			gestureStart = null;
		},
		onpinchstart() {
			noteInteraction();
			gestureStart = { s: zoom, t: translation };
		},
		onpinchmove(midpoint, ratio) {
			if (!gestureStart) return;
			applyView(pinch(gestureStart, midpoint, ratio, picture, stage, limits));
			showCrosshair();
		},
		onpinchend() {
			gestureStart = null;
		},
		ontap: toggleControls,
		onreset: reset,
		onzoomat: zoomAt,
		onnudge(delta) {
			applyView(pan({ s: zoom, t: translation }, delta, picture, stage));
			showCrosshair();
			noteInteraction();
		},
		onleave: () => onexit(),
		// On a desktop the controls come to the mouse, rather than being asked for.
		onhover: keepControlsVisible
	};

	$effect(() => {
		const element = stageElement;
		if (!element) return;
		return attachGestures(element, handlers);
	});

	$effect(() => {
		keepControlsVisible();
		return () => {
			clearTimeout(hideTimer);
			clearTimeout(crosshairTimer);
		};
	});

	// The halo opens from the screen edge to its width, once, on start.
	$effect(() => {
		if (reducedMotion.current) {
			openProgress = 1;
			return;
		}
		let handle = 0;
		const started = performance.now();
		const step = () => {
			const t = (performance.now() - started) / HALO_OPEN_MS;
			openProgress = easeOutCubic(t);
			if (t < 1) handle = requestAnimationFrame(step);
		};
		handle = requestAnimationFrame(step);
		return () => cancelAnimationFrame(handle);
	});

	/**
	 * With the light off the page is black, so the strip a browser paints
	 * outside the layout viewport does not glow. With the light on it is part
	 * of the halo and must be the same pure white.
	 */
	$effect(() => {
		const root = document.documentElement;
		const previous = root.style.backgroundColor;
		root.style.backgroundColor = level === 'off' ? '#000' : '#fff';
		return () => {
			root.style.backgroundColor = previous;
		};
	});

	/** The stream swaps its width and height when the phone rotates. */
	function readIntrinsicSize() {
		streamW = video?.videoWidth ?? 0;
		streamH = video?.videoHeight ?? 0;
	}

	$effect(() => {
		const element = video;
		const current = stream;
		if (!element) return;

		element.srcObject = current;
		if (!current) {
			readIntrinsicSize();
			return;
		}

		let cancelled = false;
		element.play().then(
			() => {
				readIntrinsicSize();
				if (!cancelled) onvideoready(element);
			},
			(error: unknown) => {
				if (!cancelled) onplayfail(error);
			}
		);

		return () => {
			cancelled = true;
			element.srcObject = null;
		};
	});
</script>

<!-- The halo is the page background. Nothing is ever drawn on it. -->
<div
	class="relative h-dvh w-screen overflow-hidden"
	class:lit={level !== 'off'}
	bind:clientWidth={rootW}
	bind:clientHeight={rootH}
>
	<!--
		Only this layer takes gestures. The controls are siblings, not children,
		so a tap on a button cannot also read as a tap on the picture — which
		would hide the button before its own click landed.
	-->
	<!--
		Focusable, so the whole mirror can be driven from the keyboard. `application`
		is the honest role: the stage handles arrows and +/-/0 itself, and a screen
		reader should pass those keys through rather than use them for navigation.
		The a11y rule below only knows a fixed list of interactive roles and does
		not include `application`, which is a widget role and legitimately focusable.
	-->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="stage absolute touch-none overflow-hidden bg-black select-none"
		class:dragging
		style:inset="{halo}px"
		role="application"
		aria-label={t.title}
		tabindex="0"
		bind:this={stageElement}
	>
		<div
			class="picture absolute top-1/2 left-1/2 will-change-transform"
			style:width="{picture.w}px"
			style:height="{picture.h}px"
			style:transform="translate(-50%, -50%) translate3d({translation.x}px, {translation.y}px, 0)
			scale({zoom})"
		>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={video}
				autoplay
				muted
				playsinline
				onloadedmetadata={readIntrinsicSize}
				onresize={readIntrinsicSize}
			></video>
		</div>
	</div>

	{#if crosshairVisible}
		<div
			class="pointer-events-none absolute top-1/2 left-1/2"
			style:transform="translate(-50%, -50%) translate3d({anchor.x}px, {anchor.y}px, 0)"
			transition:fade={{ duration: reducedMotion.current ? 0 : CROSSHAIR_FADE_MS }}
		>
			<Crosshair />
		</div>
	{/if}

	{#if controlsVisible}
		<div
			class="pointer-events-none absolute inset-x-0 flex justify-center"
			style:bottom="calc(env(safe-area-inset-bottom) + 0.75rem)"
			transition:fade={{ duration: reducedMotion.current ? 0 : PILL_FADE_MS }}
		>
			<div class="pointer-events-auto">
				<ControlPill
					{t}
					{level}
					{zoom}
					onlight={() => {
						({ level, rising } = nextHaloStep({ level, rising }));
						keepControlsVisible();
					}}
					onzoomreset={() => {
						zoom = ZOOM_START;
						keepControlsVisible();
					}}
					{onexit}
				/>
			</div>
		</div>
	{/if}

	{#if debug}
		<DebugOverlay
			{stream}
			{video}
			streamSize={source}
			stageSize={stage}
			{cover}
			{zoom}
			{upgradeState}
			{wakeLockStatus}
			{centre}
		/>
	{/if}
</div>

<style>
	.stage {
		cursor: grab;
	}

	.stage.dragging {
		cursor: grabbing;
	}

	/* Lagoon is the focus ring for light surfaces; over the picture it is white. */
	.stage:focus-visible {
		outline: 3px solid #fff;
		outline-offset: -3px;
	}

	/* Pure white, always. The halo is the light, not a decoration. */
	.lit {
		background-color: #ffffff;
	}

	/*
		Centred with left/top 50% and a -50% shift rather than `inset: 0; margin:
		auto`: auto margins are not allowed to go negative, so as soon as the
		picture is bigger than the stage the browser pins it to the left and top
		instead of centring it, and the crop is taken from the wrong place.
	*/
	.picture {
		transform-origin: 50% 50%;
	}

	video {
		display: block;
		width: 100%;
		height: 100%;
		/* The element already carries the stream's aspect ratio, so `fill` is
		   exact — unlike the `contain` default, which can leave hairline bars. */
		object-fit: fill;
		transform: scaleX(-1);
		-webkit-touch-callout: none;
	}
</style>
