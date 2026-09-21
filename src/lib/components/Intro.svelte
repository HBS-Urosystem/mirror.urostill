<script lang="ts">
	import Close from '$lib/icons/Close.svelte';
	import type { Strings } from '$lib/i18n';
	import { isIos, isStandalone } from '$lib/platform';

	let {
		t,
		busy = false,
		onstart
	}: {
		t: Strings;
		busy?: boolean;
		onstart: () => void;
	} = $props();

	// Only iOS needs telling, and only while the app is still a web page.
	// Dismissal lasts for this visit only: nothing is stored — hard rule 2.
	let dismissed = $state(false);
	const offerInstall =
		isIos(navigator.userAgent, navigator.maxTouchPoints) &&
		!isStandalone(
			window.matchMedia('(display-mode: standalone)').matches,
			(navigator as Navigator & { standalone?: boolean }).standalone
		);
</script>

<main
	class="flex min-h-dvh flex-col bg-porcelain pt-[calc(2.5rem+env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] text-ink"
>
	<div class="mx-auto flex w-full max-w-[34ch] flex-1 flex-col justify-between gap-10">
		<div>
			<h1 class="text-title">{t.title}</h1>

			<ol class="mt-8 list-decimal space-y-4 pl-7 text-body marker:font-semibold">
				<li>{t.step1}</li>
				<li>{t.step2}</li>
				<li>{t.step3}</li>
			</ol>

			<p class="mt-8 text-note">{t.privacy}</p>
		</div>

		<div>
			{#if offerInstall && !dismissed}
				<div class="mb-6 flex items-start gap-2 border-t border-base-300 pt-4">
					<p class="flex-1 text-note">{t.installHint}</p>
					<button
						class="-mt-3 -mr-3 flex min-h-12 min-w-12 items-center justify-center"
						type="button"
						aria-label={t.dismiss}
						onclick={() => (dismissed = true)}
					>
						<Close size={20} />
					</button>
				</div>
			{/if}

			<button
				class="btn w-full btn-primary"
				type="button"
				disabled={busy}
				aria-busy={busy}
				onclick={onstart}
			>
				{t.start}
			</button>
		</div>
	</div>
</main>
