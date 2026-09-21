<script lang="ts">
	import Alert from '$lib/icons/Alert.svelte';
	import type { Strings } from '$lib/i18n';

	let {
		t,
		message,
		detail = '',
		onretry,
		onexit
	}: {
		t: Strings;
		message: string;
		/** The raw exception name. Debug mode only. */
		detail?: string;
		onretry: () => void;
		onexit: () => void;
	} = $props();
</script>

<main
	class="flex min-h-dvh flex-col bg-porcelain pt-[calc(2.5rem+env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] text-ink"
>
	<div class="mx-auto flex w-full max-w-[34ch] flex-1 flex-col justify-between gap-10">
		<div>
			<Alert class="text-alert" />
			<p class="mt-6 text-body" role="alert">{message}</p>
			{#if detail}
				<p class="mt-3 font-mono text-note opacity-60">{detail}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-3">
			<button class="btn w-full btn-primary" type="button" onclick={onretry}>{t.retry}</button>
			<button class="btn w-full" type="button" onclick={onexit}>{t.exit}</button>
		</div>
	</div>
</main>
