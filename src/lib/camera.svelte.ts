import { CAMERA_IDEAL, RES_FPS_FLOOR, RES_MAX_LONG_SIDE, RES_PROBE_MS } from './config';

export type CameraErrorKey =
	'errDenied' | 'errNoCamera' | 'errInUse' | 'errInsecure' | 'errUnsupported';

/** DOMException and OverconstrainedError are not both `Error` subclasses. */
export function errorName(error: unknown): string {
	if (typeof error === 'object' && error !== null && 'name' in error) {
		return String((error as { name: unknown }).name);
	}
	return '';
}

export function mapCameraError(error: unknown): CameraErrorKey {
	switch (errorName(error)) {
		case 'NotAllowedError':
		case 'SecurityError':
			return 'errDenied';
		case 'NotFoundError':
		case 'OverconstrainedError':
			return 'errNoCamera';
		case 'NotReadableError':
		case 'AbortError':
			return 'errInUse';
		default:
			return 'errUnsupported';
	}
}

/**
 * How the one-off resolution probe went. Reported in the debug overlay so the
 * phase 5 device pass can record it.
 */
export type UpgradeState = 'idle' | 'probing' | 'upgraded' | 'fellback' | 'unavailable';

export interface Resolution {
	width: number;
	height: number;
}

/** Shrinks a resolution to fit a maximum long side, keeping the aspect ratio. */
export function capResolution(width: number, height: number, maxLongSide: number): Resolution {
	const longSide = Math.max(width, height);
	if (longSide <= maxLongSide || longSide <= 0) return { width, height };
	const scale = maxLongSide / longSide;
	return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function isWorthUpgrading(capabilities: MediaTrackCapabilities | undefined): boolean {
	const width = capabilities?.width?.max ?? 0;
	const height = capabilities?.height?.max ?? 0;
	return width * height > CAMERA_IDEAL.width * CAMERA_IDEAL.height;
}

/**
 * Counts delivered frames rather than believing the reported frame rate: a
 * phone will happily accept a 4K constraint and then deliver 12 fps.
 * Resolves NaN when the browser has no per-frame callback.
 */
function measureFps(video: HTMLVideoElement, ms: number): Promise<number> {
	const request = video.requestVideoFrameCallback?.bind(video);
	if (!request) return Promise.resolve(NaN);

	return new Promise((resolve) => {
		const started = performance.now();
		let frames = 0;
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			resolve((frames * 1000) / Math.max(1, performance.now() - started));
		};
		// A stalled stream never calls back at all, and that is a result too.
		setTimeout(finish, ms * 2);
		const tick = () => {
			if (done) return;
			frames++;
			if (performance.now() - started >= ms) finish();
			else request(tick);
		};
		request(tick);
	});
}

export class Camera {
	stream = $state<MediaStream | null>(null);
	errorKey = $state<CameraErrorKey | null>(null);
	/** The raw exception name. Shown in debug mode only. */
	lastErrorName = $state('');

	capabilities = $state<MediaTrackCapabilities | null>(null);
	upgradeState = $state<UpgradeState>('idle');
	/** The frame rate counted during the probe. NaN when it could not be measured. */
	probedFps = $state(Number.NaN);

	/**
	 * The mode settled on, kept in memory for this session only so resuming
	 * does not probe again. Never persisted — hard rule 2.
	 */
	#session: Resolution | null = null;
	#probed = false;

	get track(): MediaStreamTrack | null {
		return this.stream?.getVideoTracks()[0] ?? null;
	}

	/** Resolves true when a stream is running. Never throws. */
	async start(): Promise<boolean> {
		this.stop();
		this.errorKey = null;
		this.lastErrorName = '';

		if (!window.isSecureContext) {
			this.errorKey = 'errInsecure';
			return false;
		}
		if (!navigator.mediaDevices?.getUserMedia) {
			this.errorKey = 'errUnsupported';
			return false;
		}

		// 1080p is the safe start; a mode already settled on this session is reused.
		const target = this.#session ?? { width: CAMERA_IDEAL.width, height: CAMERA_IDEAL.height };

		try {
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					facingMode: { ideal: 'user' },
					width: { ideal: target.width },
					height: { ideal: target.height },
					frameRate: { ideal: CAMERA_IDEAL.frameRate }
				}
			});
			this.capabilities = this.track?.getCapabilities?.() ?? null;
			return true;
		} catch (error) {
			this.lastErrorName = errorName(error);
			this.errorKey = mapCameraError(error);
			return false;
		}
	}

	/** Stops every track, so the camera indicator goes off. */
	stop(): void {
		for (const track of this.stream?.getTracks() ?? []) track.stop();
		this.stream = null;
	}

	/**
	 * Asks for the sensor's full resolution and keeps it only if the frames
	 * keep arriving. Runs once per session, while the halo is opening, so the
	 * brief interruption `applyConstraints` can cause is not noticeable.
	 */
	async improveResolution(video: HTMLVideoElement): Promise<void> {
		if (this.#probed) return;
		this.#probed = true;

		const track = this.track;
		if (!track?.applyConstraints || !track.getCapabilities) {
			this.upgradeState = 'unavailable';
			return;
		}

		const capabilities = track.getCapabilities();
		this.capabilities = capabilities;
		if (!isWorthUpgrading(capabilities)) {
			this.upgradeState = 'unavailable';
			return;
		}

		const wanted = capResolution(
			capabilities.width?.max ?? 0,
			capabilities.height?.max ?? 0,
			RES_MAX_LONG_SIDE
		);

		this.upgradeState = 'probing';
		try {
			await track.applyConstraints({
				width: { ideal: wanted.width },
				height: { ideal: wanted.height },
				frameRate: { ideal: CAMERA_IDEAL.frameRate }
			});
		} catch {
			this.upgradeState = 'unavailable';
			return;
		}

		const measured = await measureFps(video, RES_PROBE_MS);
		// No per-frame callback: take the browser's word for it.
		const fps = Number.isNaN(measured) ? (track.getSettings().frameRate ?? 0) : measured;
		this.probedFps = fps;

		if (fps >= RES_FPS_FLOOR) {
			const settings = track.getSettings();
			this.#session = {
				width: settings.width ?? wanted.width,
				height: settings.height ?? wanted.height
			};
			this.upgradeState = 'upgraded';
			return;
		}

		await this.#applyBaseResolution(track);
		this.#session = { width: CAMERA_IDEAL.width, height: CAMERA_IDEAL.height };
		this.upgradeState = 'fellback';
	}

	async #applyBaseResolution(track: MediaStreamTrack): Promise<void> {
		try {
			await track.applyConstraints({
				width: { ideal: CAMERA_IDEAL.width },
				height: { ideal: CAMERA_IDEAL.height },
				frameRate: { ideal: CAMERA_IDEAL.frameRate }
			});
		} catch {
			// Keep whatever the camera is already giving us.
		}
	}

	/**
	 * The stream arrived but the element refused to play it. None of the
	 * playback failures map onto a camera-permission message, so this stays
	 * the general one and the real name goes to the debug overlay.
	 */
	failPlayback(error: unknown): void {
		this.stop();
		this.lastErrorName = errorName(error);
		this.errorKey = 'errUnsupported';
	}
}

export const camera = new Camera();
