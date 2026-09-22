<script lang="ts">
	import { page } from '$app/state';
	import { camera } from '$lib/camera.svelte';
	import ErrorView from '$lib/components/ErrorView.svelte';
	import Intro from '$lib/components/Intro.svelte';
	import Mirror from '$lib/components/Mirror.svelte';
	import { pickLang, STRINGS } from '$lib/i18n';
	import { stayAtBaseResolution } from '$lib/platform';
	import { wakeLock } from '$lib/wakelock.svelte';

	type Screen = 'intro' | 'starting' | 'live' | 'error' | 'suspended';

	const lang = pickLang(navigator.language);
	const t = STRINGS[lang];
	const debug = $derived(page.url.searchParams.get('debug') === '1');
	const stayAt1080 = $derived(stayAtBaseResolution(page.url.searchParams));

	let screen = $state<Screen>('intro');
	/** Invalidates a start still in flight when the page is hidden or exited. */
	let startToken = 0;

	$effect(() => {
		document.documentElement.lang = lang;
	});

	function enterFullscreen() {
		// Android Chrome only — iOS Safari has no element fullscreen. Never fatal.
		if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
			document.documentElement.requestFullscreen().catch(() => {});
		}
	}

	function leaveFullscreen() {
		if (document.fullscreenElement && document.exitFullscreen) {
			document.exitFullscreen().catch(() => {});
		}
	}

	async function open(): Promise<void> {
		const token = ++startToken;
		// Resuming keeps the mirror on screen rather than flashing the intro.
		if (screen !== 'suspended') screen = 'starting';

		const ok = await camera.start();
		if (token !== startToken) {
			// Hidden or exited while getUserMedia was resolving.
			camera.stop();
			return;
		}
		if (!ok) {
			screen = 'error';
			return;
		}

		screen = 'live';
		void wakeLock.request();
	}

	function start() {
		// Straight from the click, while the gesture still counts.
		enterFullscreen();
		void open();
	}

	function exit() {
		startToken++;
		camera.stop();
		void wakeLock.release();
		leaveFullscreen();
		screen = 'intro';
	}

	/** Releases the camera and the screen, so the camera indicator goes off. */
	function suspend() {
		startToken++;
		camera.stop();
		void wakeLock.release();
		screen = 'suspended';
	}

	function onVisibilityChange() {
		if (document.visibilityState === 'hidden') {
			if (screen === 'live' || screen === 'starting') suspend();
		} else if (screen === 'suspended') {
			void open();
		}
	}

	function onPageHide() {
		if (screen === 'live' || screen === 'starting') suspend();
	}

	function onPlayFail(error: unknown) {
		camera.failPlayback(error);
		void wakeLock.release();
		screen = 'error';
	}
</script>

<svelte:document onvisibilitychange={onVisibilityChange} />
<svelte:window onpagehide={onPageHide} />

{#if screen === 'error'}
	<ErrorView
		{t}
		message={t[camera.errorKey ?? 'errUnsupported']}
		detail={debug ? camera.lastErrorName : ''}
		onretry={start}
		onexit={exit}
	/>
{:else if screen === 'live' || screen === 'suspended'}
	<Mirror
		{t}
		{debug}
		stream={camera.stream}
		upgradeState={camera.upgradeState}
		wakeLockStatus={wakeLock.status}
		onexit={exit}
		onplayfail={onPlayFail}
		onvideoready={(video) => {
			if (stayAt1080) camera.skipUpgrade();
			else void camera.improveResolution(video);
		}}
	/>
{:else}
	<Intro {t} busy={screen === 'starting'} onstart={start} />
{/if}
