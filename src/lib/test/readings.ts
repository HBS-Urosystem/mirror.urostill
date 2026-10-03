/**
 * What the app records about itself, so nobody has to copy numbers off a
 * screen. Pure formatting — the values are handed in.
 */
import type { Reading } from './report';

export interface Snapshot {
	cameraMaxWidth: number;
	cameraMaxHeight: number;
	cameraMaxFps: number;
	zoomRange: { min: number; max: number } | null;
	trackWidth: number;
	trackHeight: number;
	trackFps: number;
	upgradeState: string;
	probedFps: number;
	sourcePerDevicePx: number;
	zoom: number;
	screenWidth: number;
	screenHeight: number;
	devicePixelRatio: number;
	wakeLockStatus: string;
	userAgent: string;
}

/** Trailing zeros go, but only after a decimal point — 60 must not become 6. */
const round = (n: number, places = 2) => {
	if (!Number.isFinite(n)) return '?';
	const fixed = n.toFixed(places);
	return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
};

const size = (w: number, h: number) => (w && h ? `${w}×${h}` : 'unknown');

/** What the resolution probe did, in words, rather than its internal state name. */
const PROBE_OUTCOME: Record<string, string> = {
	upgraded: 'raised and kept',
	fellback: 'raised, then set back for too few frames a second',
	unavailable: 'not raised, the camera did not allow it',
	skipped: 'not raised, held at 1920×1080 on purpose',
	probing: 'still measuring',
	idle: 'not started'
};

/** The one-off facts about the phone and the camera, taken once at the start. */
export function deviceReadings(s: Snapshot): Reading[] {
	return [
		{ label: 'Phone reports itself as', value: s.userAgent },
		{
			label: 'Screen',
			value: `${s.screenWidth}×${s.screenHeight} at ${round(s.devicePixelRatio)}× pixel ratio`
		},
		{
			label: 'Camera can do at most',
			value: `${size(s.cameraMaxWidth, s.cameraMaxHeight)} at ${round(s.cameraMaxFps, 0)} fps`
		},
		{
			label: 'Camera zoom built into the hardware',
			value: s.zoomRange ? `${round(s.zoomRange.min)}–${round(s.zoomRange.max)}` : 'none offered'
		},
		{
			label: 'Resolution the app settled on',
			value: `${size(s.trackWidth, s.trackHeight)} (${PROBE_OUTCOME[s.upgradeState] ?? s.upgradeState})`
		},
		{ label: 'Frames per second it counted', value: round(s.probedFps, 1) },
		{ label: 'Screen kept awake', value: s.wakeLockStatus }
	];
}

/**
 * How much camera detail there is behind each screen pixel. Above 1 the
 * picture is still sharp when magnified; below 1 the screen is showing more
 * pixels than the camera has.
 */
export function detailReading(stepTitle: string, s: Snapshot): Reading {
	return {
		label: `Camera detail per screen pixel — ${stepTitle.toLowerCase()}, ${round(s.zoom)}× magnified, ${size(s.trackWidth, s.trackHeight)}`,
		value: round(s.sourcePerDevicePx)
	};
}

/** Minutes and seconds, the way the countdown shows them: 9:05. */
export const clock = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(Math.max(0, Math.round(seconds)) % 60).padStart(2, '0')}`;

/**
 * What happened during the countdown, recorded by the app rather than asked:
 * the tester was told to leave the phone alone, so they were not watching it.
 * `hiddenWithLeft`: seconds left when the page was first hidden — the screen
 * went off, or the app was left. `stoppedWithLeft`: seconds left when the
 * countdown was stopped early. `null` for either means it did not happen.
 */
export function waitReadings(
	hiddenWithLeft: number | null,
	stoppedWithLeft: number | null
): Reading[] {
	return [
		{
			label: 'Screen stayed on through the countdown',
			value:
				hiddenWithLeft === null
					? 'yes'
					: `no, the screen went off or the app was left with ${clock(hiddenWithLeft)} to go`
		},
		{
			label: 'Countdown',
			value:
				stoppedWithLeft === null
					? 'ran to zero'
					: `stopped early with ${clock(stoppedWithLeft)} to go`
		}
	];
}
