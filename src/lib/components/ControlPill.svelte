<script lang="ts">
	import Close from '$lib/icons/Close.svelte';
	import Sun from '$lib/icons/Sun.svelte';
	import type { HaloLevel } from '$lib/config';
	import { fill, formatZoom, type Strings } from '$lib/i18n';

	let {
		t,
		level,
		zoom,
		onlight,
		onzoomreset,
		onexit
	}: {
		t: Strings;
		level: HaloLevel;
		zoom: number;
		onlight: () => void;
		onzoomreset: () => void;
		onexit: () => void;
	} = $props();

	/** The label carries the state, because the button itself is just a sun. */
	const lightLabel = $derived({ off: t.lightOff, soft: t.lightSoft, bright: t.lightBright }[level]);
</script>

<div class="flex items-center gap-0.5 rounded-full glass-smoke p-1">
	<button class="pill" type="button" aria-label={lightLabel} onclick={onlight}>
		<Sun {level} />
	</button>
	<button
		class="pill readout"
		type="button"
		aria-label={fill(t.zoomReset, { n: formatZoom(zoom) })}
		onclick={onzoomreset}
	>
		{formatZoom(zoom)}×
	</button>
	<button class="pill" type="button" aria-label={t.exit} onclick={onexit}>
		<Close />
	</button>
</div>

<style>
	.pill {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 48px;
		min-height: 48px;
		border-radius: 9999px;
		color: #fff;
	}

	.readout {
		padding-inline: 0.75rem;
		font-size: var(--text-readout);
		font-weight: 600;
		/* Tabular figures, so the pill does not twitch as the zoom changes. */
		font-variant-numeric: tabular-nums;
	}

	/* Lagoon is the focus ring for light surfaces; on smoked glass it is white. */
	.pill:focus-visible {
		outline: 3px solid #fff;
		outline-offset: 2px;
	}
</style>
