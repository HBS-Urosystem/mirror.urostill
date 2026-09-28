<script lang="ts">
	import { benchSettings, runSetting, type BenchResult } from '$lib/motion/bench';

	// A development instrument. Its words are not product copy, so they do not
	// live in i18n.ts, and it never touches the camera.
	let results = $state<BenchResult[]>([]);
	let running = $state(false);
	let done = $state(0);

	const settings = benchSettings();
	const budget = 4;

	async function run() {
		running = true;
		results = [];
		done = 0;

		for (const setting of settings) {
			// Let the browser paint between settings: on a slow phone this takes
			// a while, and a page that looks hung gets closed.
			await new Promise((resolve) => setTimeout(resolve, 0));
			results = [...results, runSetting(setting)];
			done++;
		}
		running = false;
	}

	const device = `${navigator.hardwareConcurrency ?? '?'} cores · dpr ${window.devicePixelRatio} · ${navigator.userAgent}`;
</script>

<svelte:head><title>Motion bench</title></svelte:head>

<main class="min-h-dvh bg-porcelain p-6 text-ink">
	<div class="mx-auto flex w-full max-w-[60ch] flex-col gap-6">
		<div>
			<h1 class="text-title">Motion bench</h1>
			<p class="mt-2 text-note">
				Runs the stabilisation estimator on frames it makes up, so the cost can be read off the
				device that will have to pay it. No camera, no network. The budget is {budget} ms a frame.
			</p>
		</div>

		<button class="btn w-full btn-primary" type="button" disabled={running} onclick={run}>
			{running ? `Measuring… ${done} of ${settings.length}` : 'Measure'}
		</button>

		{#if results.length}
			<table class="w-full text-left text-note tabular-nums">
				<thead>
					<tr class="border-b border-base-300">
						<th class="py-1 pr-2">Size</th>
						<th class="py-1 pr-2">Step</th>
						<th class="py-1 pr-2">Refine</th>
						<th class="py-1 pr-2">ms</th>
						<th class="py-1 pr-2">Worst</th>
						<th class="py-1">Answered</th>
					</tr>
				</thead>
				<tbody>
					{#each results as result (`${result.width}-${result.sampleStep}-${result.refineSearchPx}`)}
						<tr class="border-b border-base-300/60">
							<td class="py-1 pr-2">{result.width}×{result.height}</td>
							<td class="py-1 pr-2">{result.sampleStep}</td>
							<td class="py-1 pr-2">±{result.refineSearchPx}</td>
							<td class="py-1 pr-2 font-semibold" class:text-alert={result.msPerFrame > budget}>
								{result.msPerFrame.toFixed(2)}
							</td>
							<td class="py-1 pr-2" class:text-alert={result.worstAcceptedPx > 0.5}>
								{Number.isNaN(result.worstAcceptedPx)
									? '—'
									: `${result.worstAcceptedPx.toFixed(2)} px`}
							</td>
							<td class="py-1">{(result.acceptedFraction * 100).toFixed(0)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<p class="text-note opacity-70">
				Red is over budget, or past the 0.5 px the estimator is meant to hold. Copy the whole table
				into TESTING.md.
			</p>
		{/if}

		<p class="font-mono text-[11px] leading-snug opacity-60">{device}</p>
	</div>
</main>
