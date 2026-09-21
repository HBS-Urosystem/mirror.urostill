<script lang="ts">
	import ControlPill from './ControlPill.svelte';
	import DebugOverlay from './DebugOverlay.svelte';
	import type { UpgradeState } from '$lib/camera.svelte';
	import {
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
	import { easeOutCubic, haloWidth, nextHaloLevel, stageSize } from '$lib/halo';
	import type { Strings } from '$lib/i18n';
	import {
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

	const handlers: GestureHandlers = {
		onpanstart() {
			noteInteraction();
			gestureStart = { s: zoom, t: translation };
		},
		onpanmove(total) {
			if (gestureStart) applyView(pan(gestureStart, total, picture, stage));
		},
		onpanend() {
			gestureStart = null;
		},
		onpinchstart() {
			noteInteraction();
			gestureStart = { s: zoom, t: translation };
		},
		onpinchmove(midpoint, ratio) {
			if (gestureStart) applyView(pinch(gestureStart, midpoint, ratio, picture, stage, limits));
		},
		onpinchend() {
			gestureStart = null;
		},
		ontap: toggleControls,
		ondoubletap() {
			zoom = ZOOM_START;
			keepControlsVisible();
		}
	};

	$effect(() => {
		const element = stageElement;
		if (!element) return;
		return attachGestures(element, handlers);
	});

	$effect(() => {
		keepControlsVisible();
		return () => clearTimeout(hideTimer);
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
	<div
		class="absolute touch-none overflow-hidden bg-black select-none"
		style:inset="{halo}px"
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
						level = nextHaloLevel(level);
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
		/>
	{/if}
</div>

<style>
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
