<script lang="ts">
	import { asset } from '$app/paths';
	import type { Asset } from '$app/types';
	import { camera } from '$lib/camera.svelte';
	import Mirror from '$lib/components/Mirror.svelte';
	import { HALO_DEFAULT, ZOOM_START, type HaloLevel } from '$lib/config';
	import { STRINGS } from '$lib/i18n';
	import {
		clock,
		detailReading,
		deviceReadings,
		waitReadings,
		type Snapshot
	} from '$lib/test/readings';
	import { recordFrames, startReadings, type Frame } from '$lib/test/startwatch';
	import {
		adaptSteps,
		counterText,
		isLastStep,
		PROBE_WAIT_MS,
		raisedFrom,
		skipReason,
		STEPS,
		type Step
	} from '$lib/test/protocol';
	import {
		formatReport,
		readingsInOrder,
		submissionBody,
		unanswered,
		type Reading,
		type Report
	} from '$lib/test/report';
	import { runData } from '$lib/test/data';
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
	/** The panel's top bar, whichever element it is on the step. */
	const BAR =
		'flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-base-300 px-5 py-3 whitespace-nowrap';

	/**
	 * Whether the camera kept a higher resolution, fixed at the moment the
	 * tester leaves the starting step and never changed after. Deciding it once
	 * means the steps ahead cannot change under the tester; until then it is
	 * `null` and every step is shown.
	 */
	let raised = $state<boolean | null>(null);
	/** Every step, retitled for this phone, skipped ones included — what the report lists. */
	const adapted = $derived(adaptSteps(STEPS, raised));
	/** The steps this phone actually goes through. */
	const steps = $derived(adapted.filter((s) => skipReason(s, raised) === null));

	/** Navigation is by id, so a step keeps its place when the list around it changes. */
	let currentId = $state(STEPS[0].id);
	const index = $derived(
		Math.max(
			0,
			steps.findIndex((s) => s.id === currentId)
		)
	);
	const step = $derived(steps[index]);

	let answers = $state<Record<string, string>>({});
	/**
	 * What the app read off the camera, by the step it was read on. Kept as raw
	 * numbers: the readable report and the data for analysis are both made from
	 * these, so the two cannot disagree.
	 */
	let snapshotsByStep = $state<Record<string, Snapshot>>({});
	/**
	 * Every frame's arrival time and size while the camera started, for the
	 * resolution changes and the pauses around them. Recorded once, from the
	 * first picture: a restarted camera does not change resolution again, and
	 * would only overwrite the recording that matters.
	 */
	let startFrames = $state.raw<Frame[] | null | undefined>(undefined);
	let recordingStarted = false;
	let missing = $state<string[]>([]);

	let zoom = $state(ZOOM_START);
	let level = $state<HaloLevel>(HALO_DEFAULT);

	let cameraOn = $state(false);
	let starting = $state(false);
	let cameraError = $state('');
	let panelOpen = $state(true);
	/** The scrolling part of the sheet, so a new step can be put back to its top. */
	let sheetBody = $state<HTMLElement | null>(null);
	/** The step's title, which takes focus when the step changes. */
	let heading = $state<HTMLElement | null>(null);

	/**
	 * Where a waiting step's countdown is. A step that asks something first
	 * starts in 'before', and its own button starts the countdown; any other
	 * waiting step starts counting on arrival. Stopping early or reaching zero
	 * both end in 'over', which is when the step's questions are shown.
	 */
	type Wait = 'before' | 'running' | 'over';
	const waitOnArrival = (s: Step): Wait => (s.beforeWait?.length ? 'before' : 'running');
	let wait = $state<Wait>(waitOnArrival(STEPS[0]));
	let remaining = $state(0);
	/** Whether a countdown has been started at all, so there is something to report about it. */
	let waitRan = $state(false);
	/** Seconds left when the page was first hidden during the countdown: the screen went off, or the app was left. */
	let hiddenWithLeft = $state<number | null>(null);
	/** Seconds left when the countdown was stopped early. */
	let stoppedWithLeft = $state<number | null>(null);
	/** The step with the countdown, whose report lines say what happened during it. */
	const WAIT_STEP = STEPS.find((s) => s.waitSeconds)?.id ?? '';

	let sending = $state(false);
	let sent = $state(false);
	let sendError = $state('');

	/** The last numbers the mirror reported. Read when a step is finished. */
	let live = { cover: 1, zoom: 1, sourcePerDevicePx: 0 };

	const skipped = $derived(
		Object.fromEntries(
			STEPS.flatMap((s) => {
				const reason = skipReason(s, raised);
				return reason ? [[s.id, reason]] : [];
			})
		)
	);
	const readingsByStep = $derived(
		Object.fromEntries(
			Object.entries(snapshotsByStep).map(([id, snap]): [string, Reading[]] => [
				id,
				id === 'start'
					? deviceReadings(snap)
					: [detailReading(adapted.find((s) => s.id === id)?.title ?? id, snap)]
			])
		)
	);
	const readings = $derived(
		readingsInOrder(STEPS, {
			...readingsByStep,
			start: [...(readingsByStep.start ?? []), ...startReadings(startFrames)],
			[WAIT_STEP]: [
				...(readingsByStep[WAIT_STEP] ?? []),
				...(waitRan ? waitReadings(hiddenWithLeft, stoppedWithLeft) : [])
			]
		})
	);
	const report = $derived<Report>({ answers, readings, skipped });
	const summary = $derived(formatReport(adapted, report));
	const data = $derived(
		runData({
			steps: adapted,
			answers,
			skipped: Object.keys(skipped),
			snapshots: snapshotsByStep,
			startStep: 'start',
			startFrames,
			countdown: { ran: waitRan, hiddenWithLeft, stoppedWithLeft }
		})
	);

	/**
	 * The starting step holds the tester until the resolution probe has
	 * finished: the probe decides which steps follow, and a second resolution
	 * change can still be on its way while the first is being described.
	 * A camera that never reports back is let go after PROBE_WAIT_MS.
	 */
	let probeWaitOver = $state(false);
	$effect(() => {
		if (step.id !== 'start') return;
		probeWaitOver = false;
		const id = setTimeout(() => (probeWaitOver = true), PROBE_WAIT_MS);
		return () => clearTimeout(id);
	});
	const holdForProbe = $derived(
		step.id === 'start' && cameraOn && raisedFrom(camera.upgradeState) === null && !probeWaitOver
	);
	/** `null` on a step without a countdown. */
	const waitPhase = $derived(step.waitSeconds ? wait : null);
	/** Before the countdown, only what has to be read at its start; during it, nothing. */
	const shownQuestions = $derived(
		waitPhase === 'before' ? (step.beforeWait ?? []) : waitPhase === 'running' ? [] : step.questions
	);
	/** Once the countdown is over, the instructions for it are done with; the questions say what to do. */
	const shownInstructions = $derived(waitPhase === 'over' ? [] : step.instructions);
	/** The last step, once there is nothing left to wait for: what will be sent, and the button to send it. */
	const finishing = $derived(
		isLastStep(index, steps) && (waitPhase === null || waitPhase === 'over')
	);
	/**
	 * No camera picture yet, so there is nothing for the panel to keep in view:
	 * it takes the whole screen. Kept to half, it squeezed the first step's
	 * question into a strip a few lines high on an iPhone, under Safari's toolbar.
	 */
	const noPicture = $derived(!cameraOn && !sent);
	/** Open: the bottom half of the screen. Closed: only the top bar, as while the countdown runs. */
	const sheetOpen = $derived(sent || (panelOpen && waitPhase !== 'running'));

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

	/**
	 * Every step starts at its own top. The sheet scrolls, so without this the
	 * next step opens at whatever height the last answer was given at, with its
	 * title and instructions above the fold. `sent` is in here too, because the
	 * closing message replaces the step and deserves the same treatment.
	 */
	$effect(() => {
		void step.id;
		void sent;
		sheetBody?.scrollTo({ top: 0 });
		window.scrollTo({ top: 0 });
		// Moving focus to the new heading closes a phone keyboard left open by a
		// text answer, and it is what makes a screen reader read the new step out
		// instead of staying silent on a page that has just changed under it.
		heading?.focus();
	});

	/** Set the mirror up for whichever step is on screen. */
	$effect(() => {
		const s = step;
		zoom = s.zoom ?? ZOOM_START;
		level = s.light ?? HALO_DEFAULT;
		if (cameraOn && s.resolution) void camera.useResolution(s.resolution);
	});

	/**
	 * The countdown, while it runs. Leaving 'running' — by reaching zero, by
	 * stopping early, or by leaving the step — re-runs this, and the cleanup
	 * stops the clock, so nothing can set the time back afterwards.
	 */
	$effect(() => {
		const seconds = step.waitSeconds;
		if (!seconds || wait !== 'running') return;
		let left = seconds;
		remaining = left;
		const id = setInterval(() => {
			left -= 1;
			remaining = Math.max(0, left);
			if (left <= 0) {
				wait = 'over';
				panelOpen = true;
			}
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
		const measured =
			step.id === 'start' || (step.zoom !== undefined && step.resolution !== undefined);
		// Replaces whatever this step recorded the last time through it.
		if (measured) snapshotsByStep = { ...snapshotsByStep, [step.id]: snapshot() };
	}

	/**
	 * Point at the first unanswered question, if there is one. The sheet scrolls,
	 * so the question being complained about can be off the bottom of it; without
	 * this the button just looks broken.
	 */
	function showMissing(): boolean {
		if (missing.length === 0) return false;
		document
			.getElementById(`field-${missing[0]}`)
			?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		return true;
	}

	/** The countdown starts the moment what it needs at its start is in. */
	function startWait() {
		missing = unanswered({ questions: step.beforeWait ?? [] }, answers);
		if (showMissing()) return;
		hiddenWithLeft = null;
		stoppedWithLeft = null;
		waitRan = true;
		remaining = step.waitSeconds ?? 0;
		wait = 'running';
	}

	function stopWait() {
		stoppedWithLeft = remaining;
		wait = 'over';
		panelOpen = true;
	}

	async function next() {
		missing = unanswered(step, answers);
		if (showMissing()) return;

		capture();
		if (step.id === 'start') raised = raisedFrom(camera.upgradeState);

		// Read after `raised` is set, so a step this phone does not need is passed over.
		const following = steps[Math.min(index + 1, steps.length - 1)];
		if (following.needsCamera && !cameraOn) {
			// Started from this tap, while the gesture still counts.
			if (!(await startCamera())) return;
		}

		currentId = following.id;
		wait = waitOnArrival(following);
		panelOpen = !following.startClosed;
	}

	function back() {
		missing = [];
		const previous = steps[Math.max(index - 1, 0)];
		currentId = previous.id;
		wait = waitOnArrival(previous);
		panelOpen = true;
	}

	async function send() {
		sending = true;
		sendError = '';
		try {
			const response = await fetch('/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: submissionBody(FORM_NAME, answers.phone ?? '', summary, JSON.stringify(data))
			});
			if (!response.ok) throw new Error(`the server answered ${response.status}`);
			sent = true;
			stopCamera();
		} catch (error) {
			sendError = error instanceof Error ? error.message : 'the connection failed';
		}
		sending = false;
	}

	/** Only the first time: once the screen has gone off, the countdown is no longer a clean test. */
	function onVisibilityChange() {
		if (document.visibilityState !== 'hidden') return;
		if (waitPhase === 'running' && hiddenWithLeft === null) hiddenWithLeft = remaining;
	}
</script>

<svelte:head>
	<title>Mirror — guided test</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<svelte:document onvisibilitychange={onVisibilityChange} />

{#snippet guidance()}
	{#if shownInstructions.length > 0}
		<ul class="space-y-1 text-note">
			{#each shownInstructions as line (line)}
				<li>{line}</li>
			{/each}
		</ul>
	{/if}
	{#if step.link}
		<!--
			Opens in a new tab, never downloads (hard rule 1). A new tab also keeps
			this page, and its answers, where they are.
		-->
		<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
			<p class="text-note">{step.link.note}</p>
			<a
				class="btn btn-outline btn-sm"
				href={asset(step.link.href as Asset)}
				target="_blank"
				rel="noopener">{step.link.label}</a
			>
		</div>
	{/if}
{/snippet}

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
			onvideoready={(video) => {
				// Before the probe, so the frames from before the first change are in it.
				if (!recordingStarted) {
					recordingStarted = true;
					recordFrames(
						video,
						() => raisedFrom(camera.upgradeState) !== null,
						(frames) => (startFrames = frames)
					);
				}
				void camera.improveResolution(video);
			}}
			onreadings={(r) => (live = r)}
		/>
	{/if}

	<!--
		With the camera running, the panel is never more than the bottom half of
		the screen, so the picture above it stays in view. Open, it is exactly
		half on every step, so the line
		where it starts is a fixed mark on the picture: the ten-minute step uses
		that line to tell whether the picture has moved. While the countdown runs
		it is only its top bar, and the phone shows the mirror as it is normally
		used. No background blur: over live video it costs the graphics chip
		continuously, and on the ten-minute step that would count against the
		battery being measured.
	-->
	<section
		class="fixed inset-x-0 bottom-0 z-20 flex flex-col pb-[env(safe-area-inset-bottom)] shadow-2xl {noPicture
			? 'top-0 pt-[env(safe-area-inset-top)]'
			: ''}"
		class:h-[50dvh]={sheetOpen && !noPicture}
		class:bg-porcelain={!step.darkSheet}
		class:sheet-dark={step.darkSheet}
	>
		<!--
			Nothing in here breaks inside itself: on a narrow screen, or with the
			system text size turned up, a whole item moves to the next line instead.
		-->
		{#if waitPhase === 'running'}
			<header class={BAR}>
				<span class="text-note font-semibold">{counterText(step.id, raised)}</span>
				<!-- Equal-width digits keep the countdown still without a monospace font. -->
				<span class="text-note tabular-nums">{clock(remaining)} left</span>
				<button class="btn ml-auto btn-xs" type="button" onclick={stopWait}>Stop early</button>
			</header>
		{:else if cameraOn && !sent}
			<!--
				The whole bar is the button: a target as wide as the screen is easy to
				hit without looking closely, with the phone on a stand at arm's length.
			-->
			<button
				class="{BAR} w-full cursor-pointer text-left hover:bg-base-200 active:bg-base-200"
				type="button"
				aria-expanded={panelOpen}
				onclick={() => (panelOpen = !panelOpen)}
			>
				<span class="text-note font-semibold">{counterText(step.id, raised)}</span>
				<span class="ml-auto text-xs font-semibold">{panelOpen ? 'Hide' : 'Show'}</span>
			</button>
		{:else}
			<header class={BAR}>
				<span class="text-note font-semibold">{counterText(step.id, raised)}</span>
			</header>
		{/if}

		{#if sheetOpen}
			<!-- Type sized for a half-screen panel, not a page: the questions have to show. -->
			<div class="flex-1 overflow-y-auto px-5 py-3" bind:this={sheetBody}>
				{#if sent}
					<h2 class="text-xl font-bold focus:outline-none" tabindex="-1" bind:this={heading}>
						Sent. Thank you.
					</h2>
					<p class="mt-2 text-note">
						The answers are in. You can close the page; the camera has been switched off.
					</p>
				{:else}
					<h2 class="text-xl font-bold focus:outline-none" tabindex="-1" bind:this={heading}>
						{step.title}
					</h2>

					<div class="mt-2 space-y-3">{@render guidance()}</div>

					{#if cameraError}
						<p class="mt-4 text-note text-error">{cameraError}</p>
					{/if}

					{#each shownQuestions as question (question.name)}
						<div class="mt-4" id="field-{question.name}">
							{#if question.kind === 'text'}
								<label class="block text-note font-semibold" for="q-{question.name}">
									{question.label}
								</label>
								<input
									id="q-{question.name}"
									class="input mt-2 w-full"
									class:input-error={missing.includes(question.name)}
									type="text"
									inputmode={question.numeric ? 'numeric' : undefined}
									aria-required={!question.optional}
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
										{#each question.options as option (option.label)}
											<button
												class="btn btn-sm"
												class:btn-primary={answers[question.name] === option.label}
												class:btn-outline={answers[question.name] !== option.label}
												type="button"
												aria-pressed={answers[question.name] === option.label}
												onclick={() => answer(question.name, option.label)}
											>
												{option.label}
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

					{#if finishing}
						<details class="mt-6">
							<summary class="cursor-pointer text-note font-semibold">
								What will be sent ({summary.split('\n').length} lines)
							</summary>
							<pre
								class="mt-2 max-h-60 overflow-auto rounded bg-base-200 p-3 font-mono text-[0.7rem] whitespace-pre-wrap">{summary}</pre>
							<p class="mt-2 text-note">
								The same answers and measurements also go as data, for comparing phones.
							</p>
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
				{#if step.before}
					<!--
						Beside the button rather than in the list above it: it is about
						what happens when the button is pressed, and by the time the next
						step is on screen it would be too late to act on.
					-->
					<p class="border-t border-base-300 px-5 pt-3 text-note font-semibold">
						{step.before}
					</p>
				{/if}
				<!-- The parting line above carries the divider when there is one. -->
				<footer class="flex gap-3 px-5 py-3 {step.before ? '' : 'border-t border-base-300'}">
					<button class="btn btn-ghost" type="button" disabled={index === 0} onclick={back}>
						Back
					</button>
					{#if waitPhase === 'before'}
						<button class="btn flex-1 btn-primary" type="button" onclick={startWait}>
							Start the countdown
						</button>
					{:else if finishing}
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
							disabled={starting || holdForProbe}
							aria-busy={starting || holdForProbe}
							onclick={next}
						>
							{starting
								? 'Starting the camera…'
								: holdForProbe
									? 'Waiting for the camera…'
									: 'Next'}
						</button>
					{/if}
				</footer>
			{/if}
		{/if}
	</section>
</div>

<style>
	/*
		The light step's panel is dark, so it adds no light of its own to the
		light being judged. daisyUI takes its colours from these variables, so
		redefining them here gives the buttons and dividers inside a dark version.
	*/
	.sheet-dark {
		--color-base-100: #1e2b36;
		--color-base-200: #26343f;
		--color-base-300: #3b4a56;
		--color-base-content: #eef2f4;
		background-color: var(--color-base-100);
		color: var(--color-base-content);
	}
</style>
