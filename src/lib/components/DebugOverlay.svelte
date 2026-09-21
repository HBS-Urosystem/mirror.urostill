<script lang="ts">
	import { sourcePixelsPerScreenPixel, type Size } from '$lib/viewport';
	import type { WakeLockStatus } from '$lib/wakelock.svelte';

	let {
		stream,
		streamSize,
		cover,
		zoom,
		wakeLockStatus
	}: {
		stream: MediaStream | null;
		streamSize: Size;
		cover: number;
		zoom: number;
		wakeLockStatus: WakeLockStatus;
	} = $props();

	const dpr = window.devicePixelRatio || 1;

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
</div>
