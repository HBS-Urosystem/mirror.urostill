<script lang="ts">
	import Close from '$lib/icons/Close.svelte';
	import type { Strings } from '$lib/i18n';
	import { isIos, isStandalone } from '$lib/platform';
	import { MediaQuery } from 'svelte/reactivity';

	let {
		t,
		busy = false,
		onstart
	}: {
		t: Strings;
		busy?: boolean;
		onstart: () => void;
	} = $props();

	/**
	 * Copy and layout only — never behaviour, because a hybrid laptop has both
	 * a touchscreen and a trackpad and either may be in use.
	 */
	const coarse = new MediaQuery('(pointer: coarse)');
	const step2 = $derived(coarse.current ? t.step2 : t.step2Desktop);
	const step3 = $derived(coarse.current ? t.step3 : t.step3Desktop);

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
	<!--
		On a phone the steps sit at the top and the button in the thumb zone. On a
		desktop that would stretch a column across the whole screen, so the block
		is centred instead.
	-->
	<div
		class="mx-auto flex w-full flex-1 flex-col gap-10 {coarse.current
			? 'max-w-[34ch] justify-between'
			: 'max-w-[420px] justify-center'}"
	>
		<div>
			<h1 class="text-title">{t.title}</h1>

			<ol class="mt-8 list-decimal space-y-4 pl-7 text-body marker:font-semibold">
				<li>{t.step1}</li>
				<li>{step2}</li>
				<li>{step3}</li>
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
