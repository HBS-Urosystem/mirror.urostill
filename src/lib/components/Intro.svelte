<script lang="ts">
	import type { Strings } from '$lib/i18n';

	let {
		t,
		busy = false,
		onstart
	}: {
		t: Strings;
		busy?: boolean;
		onstart: () => void;
	} = $props();
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
</main>
