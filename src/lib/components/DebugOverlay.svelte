<script lang="ts">
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import type { UpgradeState } from '$lib/camera.svelte';
	import { sourcePixelsPerScreenPixel, type Size } from '$lib/viewport';
	import type { WakeLockStatus } from '$lib/wakelock.svelte';

	let {
		stream,
		video,
		streamSize,
		stageSize,
		cover,
		zoom,
		upgradeState,
		wakeLockStatus
	}: {
		stream: MediaStream | null;
		video: HTMLVideoElement | null;
		streamSize: Size;
		stageSize: Size;
		cover: number;
		zoom: number;
		upgradeState: UpgradeState;
		wakeLockStatus: WakeLockStatus;
	} = $props();

	/** Not in the standard typings: it comes from the Image Capture extensions. */
	type ZoomCapability = { min: number; max: number; step?: number };

	const dpr = window.devicePixelRatio || 1;

	const track = $derived(stream?.getVideoTracks()[0] ?? null);
	const settings: MediaTrackSettings = $derived(track?.getSettings() ?? {});
	const capabilities: MediaTrackCapabilities | null = $derived(track?.getCapabilities?.() ?? null);
	const zoomCapability = $derived(
		(capabilities as (MediaTrackCapabilities & { zoom?: ZoomCapability }) | null)?.zoom
	);
	const quality = $derived(sourcePixelsPerScreenPixel(cover, zoom, dpr));

	// Whether the stage really reaches the edge of the screen, and by how much
	// the notch and the home indicator eat into it.
	let probe = $state<HTMLElement | null>(null);
	let safeArea = $state('—');
	$effect(() => {
		const w = innerWidth.current;
		const h = innerHeight.current;
		if (!probe || w === undefined || h === undefined) return;
		const style = getComputedStyle(probe);
		safeArea = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
			.map((value) => Math.round(parseFloat(value)))
			.join('/');
	});

	/**
	 * Frames actually delivered, counted rather than reported: a phone will
	 * accept a 4K constraint and then quietly send 12 fps.
	 */
	let measuredFps = $state(0);
	$effect(() => {
		const element = video;
		const request = element?.requestVideoFrameCallback?.bind(element);
		if (!element || !request) return;

		let handle = 0;
		let frames = 0;
		let since = performance.now();
		let cancelled = false;
		const tick = () => {
			if (cancelled) return;
			frames++;
			const elapsed = performance.now() - since;
			if (elapsed >= 1000) {
				measuredFps = (frames * 1000) / elapsed;
				frames = 0;
				since = performance.now();
			}
			handle = request(tick);
		};
		handle = request(tick);
		return () => {
			cancelled = true;
			element.cancelVideoFrameCallback?.(handle);
		};
	});

	// The rAF loop only exists while the overlay is mounted, i.e. under ?debug=1.
	let frameMs = $state(0);
	$effect(() => {
		let handle = 0;
		let last = performance.now();
		let average = 0;
		const tick = (now: number) => {
			const delta = now - last;
			last = now;
			average = average === 0 ? delta : average * 0.9 + delta * 0.1;
			frameMs = average;
			handle = requestAnimationFrame(tick);
		};
		handle = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(handle);
	});

	const rows: [string, string][] = $derived([
		['viewport', `${innerWidth.current ?? 0}×${innerHeight.current ?? 0}`],
		['stage', `${Math.round(stageSize.w)}×${Math.round(stageSize.h)}`],
		['safe t/r/b/l', safeArea],
		[
			'camera max',
			capabilities
				? `${capabilities.width?.max ?? '?'}×${capabilities.height?.max ?? '?'} @ ${capabilities.frameRate?.max?.toFixed(0) ?? '?'}`
				: 'no capabilities'
		],
		[
			'native zoom',
			zoomCapability
				? `${zoomCapability.min}–${zoomCapability.max} / ${zoomCapability.step ?? '?'}`
				: 'no zoom'
		],
		['mode', `${settings.width ?? '?'}×${settings.height ?? '?'} ${upgradeState}`],
		[
			'fps',
			`${measuredFps ? measuredFps.toFixed(1) : '—'} meas / ${settings.frameRate?.toFixed(0) ?? '?'} rep`
		],
		['stream', `${streamSize.w}×${streamSize.h}`],
		['facing', settings.facingMode ?? '—'],
		['zoom', `${zoom.toFixed(2)}×`],
		['cover', cover.toFixed(3)],
		['src px / device px', quality.toFixed(2)],
		['dpr', dpr.toFixed(2)],
		['wake lock', wakeLockStatus],
		['frame', `${frameMs.toFixed(1)} ms`]
	]);
</script>

<div
	class="pointer-events-none absolute top-0 left-0 m-2 rounded-lg bg-black/70 px-2.5 pb-2 font-mono text-[11px] leading-snug text-white"
	style="padding-top: calc(0.5rem + env(safe-area-inset-top))"
>
	{#each rows as [label, value] (label)}
		<div><span class="opacity-60">{label}</span> {value}</div>
	{/each}
	<span bind:this={probe} class="safe-probe"></span>
</div>

<style>
	/* Only here to be measured: env() is not readable from script directly. */
	.safe-probe {
		position: absolute;
		visibility: hidden;
		padding-top: env(safe-area-inset-top);
		padding-right: env(safe-area-inset-right);
		padding-bottom: env(safe-area-inset-bottom);
		padding-left: env(safe-area-inset-left);
	}
</style>
