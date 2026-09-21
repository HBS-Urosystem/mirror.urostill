<script lang="ts">
	import DebugOverlay from './DebugOverlay.svelte';
	import { ZOOM_START } from '$lib/config';
	import type { Strings } from '$lib/i18n';
	import { coverScale, pictureSize } from '$lib/viewport';
	import type { WakeLockStatus } from '$lib/wakelock.svelte';

	let {
		t,
		stream,
		debug = false,
		wakeLockStatus,
		onexit,
		onplayfail
	}: {
		t: Strings;
		stream: MediaStream | null;
		debug?: boolean;
		wakeLockStatus: WakeLockStatus;
		onexit: () => void;
		onplayfail: (error: unknown) => void;
	} = $props();

	let video = $state<HTMLVideoElement | null>(null);
	let stageW = $state(0);
	let stageH = $state(0);
	let streamW = $state(0);
	let streamH = $state(0);

	// Phase 2 replaces this with the gesture-driven transform.
	const zoom = ZOOM_START;

	const stage = $derived({ w: stageW, h: stageH });
	const source = $derived({ w: streamW, h: streamH });
	const picture = $derived(pictureSize(stage, source));
	const cover = $derived(coverScale(stage, source));

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
		element.play().then(readIntrinsicSize, (error: unknown) => {
			if (!cancelled) onplayfail(error);
		});

		return () => {
			cancelled = true;
			element.srcObject = null;
		};
	});
</script>

<div
	class="relative h-dvh w-screen touch-none overflow-hidden bg-black"
	bind:clientWidth={stageW}
	bind:clientHeight={stageH}
>
	<div
		class="picture absolute inset-0 m-auto will-change-transform"
		style:width="{picture.w}px"
		style:height="{picture.h}px"
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

	<!-- Phase 3 replaces this with the control pill. -->
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

	{#if debug}
		<DebugOverlay {stream} streamSize={source} stageSize={stage} {cover} {zoom} {wakeLockStatus} />
	{/if}
</div>

<style>
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
	}
</style>
