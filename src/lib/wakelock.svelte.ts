export type WakeLockStatus = 'idle' | 'held' | 'unsupported' | 'failed';

/**
 * Keeps the screen on while the mirror runs. The browser drops the lock on
 * its own whenever the page is hidden, so the screen state machine asks for
 * it again on resume. If the API is missing the mirror still works.
 */
export class ScreenWakeLock {
	status = $state<WakeLockStatus>('idle');
	#sentinel: WakeLockSentinel | null = null;

	async request(): Promise<void> {
		if (!('wakeLock' in navigator)) {
			this.status = 'unsupported';
			return;
		}
		if (this.#sentinel && !this.#sentinel.released) return;

		try {
			const sentinel = await navigator.wakeLock.request('screen');
			this.#sentinel = sentinel;
			this.status = 'held';
			sentinel.addEventListener('release', () => {
				if (this.#sentinel === sentinel) this.#sentinel = null;
				if (this.status === 'held') this.status = 'idle';
			});
		} catch {
			// Refused, usually because the page lost visibility mid-request.
			this.status = 'failed';
		}
	}

	async release(): Promise<void> {
		const sentinel = this.#sentinel;
		this.#sentinel = null;
		if (this.status === 'held') this.status = 'idle';
		try {
			await sentinel?.release();
		} catch {
			// Already released by the browser.
		}
	}
}

export const wakeLock = new ScreenWakeLock();
