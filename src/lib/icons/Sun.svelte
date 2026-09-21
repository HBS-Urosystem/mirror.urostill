<script lang="ts">
	import type { HaloLevel } from '$lib/config';
	import { sunRays } from '$lib/halo';

	let {
		level,
		size = 24,
		class: className = ''
	}: { level: HaloLevel; size?: number; class?: string } = $props();

	const rays = $derived(sunRays(level));
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	class={className}
	aria-hidden="true"
>
	<circle cx="12" cy="12" r="4.5" />
	{#each rays as ray (ray.x2 + ':' + ray.y2)}
		<line x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} />
	{/each}
	{#if level === 'off'}
		<path d="M5 19L19 5" />
	{/if}
</svg>
