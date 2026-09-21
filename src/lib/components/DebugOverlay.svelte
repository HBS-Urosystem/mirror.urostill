<script lang="ts">
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import { sourcePixelsPerScreenPixel, type Size } from '$lib/viewport';
	import type { WakeLockStatus } from '$lib/wakelock.svelte';

	let {
		stream,
		streamSize,
		stageSize,
		cover,
		zoom,
		wakeLockStatus
	}: {
		stream: MediaStream | null;
		streamSize: Size;
		stageSize: Size;
		cover: number;
		zoom: number;
		wakeLockStatus: WakeLockStatus;
	} = $props();

	const dpr = window.devicePixelRatio || 1;

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

	const settings: MediaTrackSettings = $derived(stream?.getVideoTracks()[0]?.getSettings() ?? {});
	const quality = $derived(sourcePixelsPerScreenPixel(cover, zoom, dpr));

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
		['stream', `${streamSize.w}×${streamSize.h}`],
		[
			'track',
			`${settings.width ?? '?'}×${settings.height ?? '?'} @ ${settings.frameRate?.toFixed(0) ?? '?'} fps`
		],
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
