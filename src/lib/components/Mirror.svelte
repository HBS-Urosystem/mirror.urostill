<script lang="ts">
	import DebugOverlay from './DebugOverlay.svelte';
	import type { UpgradeState } from '$lib/camera.svelte';
	import { ZOOM_MAX, ZOOM_MIN, ZOOM_START } from '$lib/config';
	import { attachGestures, type GestureHandlers } from '$lib/gestures.svelte';
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

	let stageElement = $state<HTMLElement | null>(null);
	let video = $state<HTMLVideoElement | null>(null);
	let stageW = $state(0);
	let stageH = $state(0);
	let streamW = $state(0);
	let streamH = $state(0);

	let zoom = $state(ZOOM_START);
	/**
	 * The picture point held at the stage centre, in normalised picture
	 * coordinates — so a resize, a rotation or a change of stream size cannot
	 * move what the user put in the middle.
	 */
	let centre = $state<Vec>({ x: 0.5, y: 0.5 });
	/** Phase 3 replaces this with the auto-hiding control pill. */
	let controlsVisible = $state(true);

	const limits = { min: ZOOM_MIN, max: ZOOM_MAX };

	const stage = $derived({ w: stageW, h: stageH });
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

	const handlers: GestureHandlers = {
		onpanstart() {
			gestureStart = { s: zoom, t: translation };
		},
		onpanmove(total) {
			if (gestureStart) applyView(pan(gestureStart, total, picture, stage));
		},
		onpanend() {
			gestureStart = null;
		},
		onpinchstart() {
			gestureStart = { s: zoom, t: translation };
		},
		onpinchmove(midpoint, ratio) {
			if (gestureStart) applyView(pinch(gestureStart, midpoint, ratio, picture, stage, limits));
		},
		onpinchend() {
			gestureStart = null;
		},
		ontap() {
			controlsVisible = !controlsVisible;
		},
		ondoubletap() {
			zoom = ZOOM_START;
			controlsVisible = true;
		}
	};

	$effect(() => {
		const element = stageElement;
		if (!element) return;
		return attachGestures(element, handlers);
	});

	/** The stream swaps its width and height when the phone rotates. */
	function readIntrinsicSize() {
		streamW = video?.videoWidth ?? 0;
		streamH = video?.videoHeight ?? 0;
	}

	// Phase 3 turns this into the halo, which is pure white.
	$effect(() => {
		const root = document.documentElement;
		const previous = root.style.backgroundColor;
		root.style.backgroundColor = '#000';
		return () => {
			root.style.backgroundColor = previous;
		};
	});

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

<div class="relative h-dvh w-screen overflow-hidden bg-black">
	<!--
		Only this layer takes gestures. The controls are siblings, not children,
		so a tap on a button cannot also read as a tap on the picture — which
		would hide the button before its own click landed.
	-->
	<div
		class="absolute inset-0 touch-none select-none"
		bind:this={stageElement}
		bind:clientWidth={stageW}
		bind:clientHeight={stageH}
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

	<!-- Phase 3 replaces this with the control pill. -->
	{#if controlsVisible}
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
		>
			<button
				class="pointer-events-auto min-h-12 rounded-full glass-smoke px-6 text-chip font-medium"
				type="button"
				onclick={onexit}
			>
				{t.exit}
			</button>
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
