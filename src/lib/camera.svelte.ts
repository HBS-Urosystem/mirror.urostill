import { CAMERA_IDEAL } from './config';

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

export class Camera {
	stream = $state<MediaStream | null>(null);
	errorKey = $state<CameraErrorKey | null>(null);
	/** The raw exception name. Shown in debug mode only. */
	lastErrorName = $state('');

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

		try {
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					facingMode: { ideal: 'user' },
					width: { ideal: CAMERA_IDEAL.width },
					height: { ideal: CAMERA_IDEAL.height },
					frameRate: { ideal: CAMERA_IDEAL.frameRate }
				}
			});
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
