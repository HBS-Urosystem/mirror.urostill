<script lang="ts">
	import { camera } from '$lib/camera.svelte';
	import Mirror from '$lib/components/Mirror.svelte';
	import { HALO_DEFAULT, ZOOM_START, type HaloLevel } from '$lib/config';
	import { STRINGS } from '$lib/i18n';
	import { detailReading, deviceReadings, type Snapshot } from '$lib/test/readings';
	import { isLastStep, STEPS } from '$lib/test/protocol';
	import {
		formatReport,
		submissionBody,
		unanswered,
		type Reading,
		type Report
	} from '$lib/test/report';
	import { wakeLock } from '$lib/wakelock.svelte';

	/**
	 * The guided device test. Everything the tester is asked is in
	 * `$lib/test/protocol`; this file walks that list, sets the mirror up for
	 * each question, records what the app can measure for itself, and posts the
	 * lot once at the end.
	 *
	 * English only, like /bench: this route is part of the test build and is
	 * deleted before any release, so its wording never reaches a user of the
	 * mirror. It is also the one place in the app that sends anything — the
	 * mirror itself still sends nothing.
	 */
	const t = STRINGS.en;
	const FORM_NAME = 'mirror-test';

	let index = $state(0);
	const step = $derived(STEPS[index]);
	const stepNumber = $derived(index + 1);

	let answers = $state<Record<string, string>>({});
	let readings = $state<Reading[]>([]);
	let problems = $state<string[]>([]);
	let missing = $state<string[]>([]);

	let zoom = $state(ZOOM_START);
	let level = $state<HaloLevel>(HALO_DEFAULT);

	let cameraOn = $state(false);
	let starting = $state(false);
	let cameraError = $state('');
	let panelOpen = $state(true);

	let remaining = $state(0);
	let waitSkipped = $state(false);

	let sending = $state(false);
	let sent = $state(false);
	let sendError = $state('');

	/** The last numbers the mirror reported. Read when a step is finished. */
	let live = { cover: 1, zoom: 1, sourcePerDevicePx: 0 };

	const report = $derived<Report>({ answers, readings, problems });
	const summary = $derived(formatReport(STEPS, report));
	const waiting = $derived(remaining > 0);

	/** Record an answer, and stop complaining about that question. */
	function answer(name: string, value: string) {
		answers = { ...answers, [name]: value };
		if (value.trim()) missing = missing.filter((n) => n !== name);
	}

	function snapshot(): Snapshot {
		const settings = camera.track?.getSettings?.() ?? {};
		const caps = camera.capabilities as
			| (MediaTrackCapabilities & {
					zoom?: { min?: number; max?: number };
			  })
			| null;
		const range = caps?.zoom;
		return {
			cameraMaxWidth: caps?.width?.max ?? 0,
			cameraMaxHeight: caps?.height?.max ?? 0,
			cameraMaxFps: caps?.frameRate?.max ?? 0,
			zoomRange: range ? { min: range.min ?? 0, max: range.max ?? 0 } : null,
			trackWidth: settings.width ?? 0,
			trackHeight: settings.height ?? 0,
			trackFps: settings.frameRate ?? 0,
			upgradeState: camera.upgradeState,
			probedFps: camera.probedFps,
			sourcePerDevicePx: live.sourcePerDevicePx,
			zoom: live.zoom,
			screenWidth: window.innerWidth,
			screenHeight: window.innerHeight,
			devicePixelRatio: window.devicePixelRatio || 1,
			wakeLockStatus: wakeLock.status,
			userAgent: navigator.userAgent
		};
	}

	/** Set the mirror up for whichever step is on screen. */
	$effect(() => {
		const s = step;
		zoom = s.zoom ?? ZOOM_START;
		level = s.light ?? HALO_DEFAULT;
		if (cameraOn && s.resolution) void camera.useResolution(s.resolution);
	});

	/** The countdown on the ten-minute step. */
	$effect(() => {
		const seconds = step.waitSeconds;
		if (!seconds) {
			remaining = 0;
			return;
		}
		let left = seconds;
		remaining = left;
		const id = setInterval(() => {
			left -= 1;
			remaining = Math.max(0, left);
			if (left <= 0) clearInterval(id);
		}, 1000);
		return () => clearInterval(id);
	});

	async function startCamera(): Promise<boolean> {
		starting = true;
		cameraError = '';
		const ok = await camera.start();
		starting = false;
		if (!ok) {
			// The same sentence the mirror itself shows, plus the raw exception name,
			// which is the part worth reporting back.
			cameraError = `${t[camera.errorKey ?? 'errUnsupported']} (${camera.lastErrorName || 'no name given'})`;
			return false;
		}
		cameraOn = true;
		void wakeLock.request();
		return true;
	}

	function stopCamera() {
		camera.stop();
		void wakeLock.release();
		cameraOn = false;
	}

	/** Record what the app can measure, before moving off the step. */
	function capture() {
		if (step.id === 'start') readings = [...readings, ...deviceReadings(snapshot())];
		if (step.zoom !== undefined && step.resolution !== undefined && step.id !== 'start') {
			readings = [...readings, detailReading(step.title, snapshot())];
		}
		if (waitSkipped) {
			problems = [...problems, `The ${step.title.toLowerCase()} wait was cut short.`];
			waitSkipped = false;
		}
	}

	async function next() {
		missing = unanswered(step, answers);
		if (missing.length > 0) {
			// The sheet scrolls, so the question being complained about can be off
			// the bottom of it; without this the Next button just looks broken.
			document
				.getElementById(`field-${missing[0]}`)
				?.scrollIntoView({ block: 'center', behavior: 'smooth' });
			return;
		}

		capture();

		const following = STEPS[index + 1];
		if (following?.needsCamera && !cameraOn) {
			// Started from this tap, while the gesture still counts.
			if (!(await startCamera())) return;
		}

		index = Math.min(index + 1, STEPS.length - 1);
		panelOpen = true;
	}

	function back() {
		missing = [];
		index = Math.max(index - 1, 0);
		panelOpen = true;
	}

	async function send() {
		sending = true;
		sendError = '';
		try {
			const response = await fetch('/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: submissionBody(FORM_NAME, answers.phone ?? '', summary)
			});
			if (!response.ok) throw new Error(`the server answered ${response.status}`);
			sent = true;
			stopCamera();
		} catch (error) {
			sendError = error instanceof Error ? error.message : 'the connection failed';
		}
		sending = false;
	}

	function onVisibilityChange() {
		if (document.visibilityState !== 'hidden' || !cameraOn) return;
		if (step.waitSeconds && remaining > 0) {
			problems = [
				...problems,
				`The screen went dark or the app was left during the ${step.title.toLowerCase()} step, with ${remaining}s to go.`
			];
		}
	}

	const clock = (seconds: number) =>
		`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
</script>

<svelte:head>
	<title>Mirror — guided test</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<svelte:document onvisibilitychange={onVisibilityChange} />

<div class="relative min-h-dvh bg-porcelain text-ink">
	{#if cameraOn}
		<Mirror
			{t}
			stream={camera.stream}
			upgradeState={camera.upgradeState}
			wakeLockStatus={wakeLock.status}
			controls={false}
			bind:zoom
			bind:level
			onexit={stopCamera}
			onplayfail={(error) => {
				camera.failPlayback(error);
				cameraError = `${t.errUnsupported} (${camera.lastErrorName || 'no name given'})`;
				stopCamera();
			}}
			onvideoready={(video) => void camera.improveResolution(video)}
			onreadings={(r) => (live = r)}
		/>
	{/if}

	<!--
		The sheet sits over the picture and is kept short enough that the top of
		the mirror stays visible; "Hide" gets it out of the way completely.
	-->
	<section
		class="fixed inset-x-0 bottom-0 z-20 flex max-h-[62dvh] flex-col bg-porcelain/97 pb-[env(safe-area-inset-bottom)] backdrop-blur"
		class:shadow-2xl={cameraOn}
	>
		<header class="flex items-center gap-3 border-b border-base-300 px-5 py-3">
			<span class="text-note font-semibold">Step {stepNumber} of {STEPS.length}</span>
			{#if waiting}
				<span class="font-mono text-note tabular-nums">{clock(remaining)} left</span>
			{/if}
			<span class="flex-1"></span>
			{#if cameraOn}
				<button class="btn btn-ghost btn-xs" type="button" onclick={() => (panelOpen = !panelOpen)}>
					{panelOpen ? 'Hide' : 'Show'}
				</button>
			{/if}
		</header>

		{#if panelOpen}
			<div class="flex-1 overflow-y-auto px-5 py-4">
				{#if sent}
					<h2 class="text-title">Sent. Thank you.</h2>
					<p class="mt-3 text-body">
						The answers are in. You can close the page; the camera has been switched off.
					</p>
				{:else}
					<h2 class="text-title">{step.title}</h2>

					<ul class="mt-3 space-y-2 text-body">
						{#each step.instructions as line (line)}
							<li>{line}</li>
						{/each}
					</ul>

					{#if cameraError}
						<p class="mt-4 text-note text-error">{cameraError}</p>
					{/if}

					{#each step.questions as question (question.name)}
						<div class="mt-5" id="field-{question.name}">
							{#if question.kind === 'text'}
								<label class="block text-note font-semibold" for="q-{question.name}">
									{question.label}
								</label>
								<input
									id="q-{question.name}"
									class="input mt-2 w-full"
									class:input-error={missing.includes(question.name)}
									type="text"
									placeholder={question.placeholder ?? ''}
									bind:value={() => answers[question.name] ?? '', (v) => answer(question.name, v)}
								/>
								{#if missing.includes(question.name)}
									<p class="mt-1 text-note text-error">Fill this in.</p>
								{/if}
							{:else}
								<!--
									A fieldset rather than a label: a group of buttons is not one
									control, so there is nothing for a label to point at.
								-->
								<fieldset>
									<legend class="text-note font-semibold">{question.label}</legend>
									<div class="mt-2 flex flex-wrap gap-2">
										{#each question.options as option (option)}
											<button
												class="btn btn-sm"
												class:btn-primary={answers[question.name] === option}
												class:btn-outline={answers[question.name] !== option}
												type="button"
												aria-pressed={answers[question.name] === option}
												onclick={() => answer(question.name, option)}
											>
												{option}
											</button>
										{/each}
									</div>
									{#if missing.includes(question.name)}
										<p class="mt-1 text-note text-error">Pick one.</p>
									{/if}
								</fieldset>
							{/if}
						</div>
					{/each}

					{#if isLastStep(index)}
						<details class="mt-6">
							<summary class="cursor-pointer text-note font-semibold">
								What will be sent ({summary.split('\n').length} lines)
							</summary>
							<pre
								class="mt-2 max-h-60 overflow-auto rounded bg-base-200 p-3 font-mono text-[0.7rem] whitespace-pre-wrap">{summary}</pre>
						</details>

						{#if sendError}
							<div class="mt-4 rounded border border-error p-3">
								<p class="text-note text-error">
									It did not go through: {sendError}. Copy the text above and send it by hand —
									nothing is stored, so do that before closing the page.
								</p>
							</div>
						{/if}
					{/if}
				{/if}
			</div>

			{#if !sent}
				<footer class="flex gap-3 border-t border-base-300 px-5 py-3">
					<button class="btn btn-ghost" type="button" disabled={index === 0} onclick={back}>
						Back
					</button>
					{#if waiting}
						<button
							class="btn flex-1"
							type="button"
							onclick={() => {
								remaining = 0;
								waitSkipped = true;
							}}
						>
							Stop the wait early
						</button>
					{:else if isLastStep(index)}
						<button
							class="btn flex-1 btn-primary"
							type="button"
							disabled={sending}
							aria-busy={sending}
							onclick={send}
						>
							{sending ? 'Sending…' : 'Send the results'}
						</button>
					{:else}
						<button
							class="btn flex-1 btn-primary"
							type="button"
							disabled={starting}
							aria-busy={starting}
							onclick={next}
						>
							{starting ? 'Starting the camera…' : 'Next'}
						</button>
					{/if}
				</footer>
			{/if}
		{/if}
	</section>
</div>
