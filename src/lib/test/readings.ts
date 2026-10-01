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
			label: 'Quality the app settled on',
			value: `${size(s.trackWidth, s.trackHeight)}, ${s.upgradeState}`
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
