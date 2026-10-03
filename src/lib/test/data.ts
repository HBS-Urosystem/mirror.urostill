/**
 * The run as data for comparing phones: the same facts as the readable
 * summary, filed under keys that stay the same when the wording changes, as
 * values a script can use without reading them first, and with the version of
 * the test they belong to. Sent as JSON in the form's `data` field.
 *
 * Plain functions, no DOM.
 */
import { PROTOCOL_VERSION, type Question, type Step, type Value } from './protocol';
import type { Snapshot } from './readings';
import { analyseStart, type Frame } from './startwatch';

/** The key an answer is sent under: the question's name, with its unit when it has one. */
export const answerKey = (q: Question) => (q.unit ? `${q.name}_${q.unit}` : q.name);

/**
 * The value sent for an answer. A picked option sends the value it carries. A
 * number typed in is sent as a number, forgiving a % sign or a unit after it
 * ("35 cm") and a decimal comma. Anything that does not fit is sent as typed
 * rather than lost. Blank is null.
 */
export function answerValue(q: Question, raw: string | undefined): Value {
	const text = raw?.trim() ?? '';
	if (!text) return null;
	if (q.kind === 'choice') return q.options.find((o) => o.label === text)?.value ?? text;
	if (q.numeric) {
		const n = Number(
			text
				.replace(/\s*(%|[a-z]+)$/i, '')
				.replace(',', '.')
				.trim()
		);
		return Number.isFinite(n) ? n : text;
	}
	return text;
}

/** Rounded, and null instead of NaN or Infinity, which JSON cannot carry. */
const round = (n: number, places: number) =>
	Number.isFinite(n) ? Number(n.toFixed(places)) : null;
const seconds = (ms: number) => round(ms / 1000, 2);

/** What happened during the countdown, as the page recorded it. */
export interface Countdown {
	ran: boolean;
	/** Seconds left when the page was first hidden, or null if it never was. */
	hiddenWithLeft: number | null;
	/** Seconds left when the countdown was stopped early, or null if it ran out. */
	stoppedWithLeft: number | null;
}

export interface RunInput {
	/** Every step of the test. */
	steps: Step[];
	answers: Record<string, string>;
	/** What the app read off the camera, by the step it was read on. */
	snapshots: Record<string, Snapshot>;
	/** The step whose snapshot holds the camera and the device. */
	startStep: string;
	startFrames: Frame[] | null | undefined;
	countdown: Countdown;
}

/** `null`: nothing recorded. `measurable: false`: this browser cannot be recorded from. */
function startData(frames: Frame[] | null | undefined) {
	if (frames === undefined) return null;
	if (frames === null) return { measurable: false };
	const analysis = analyseStart(frames);
	if (!analysis) return { measurable: true, frames: frames.length };
	return {
		measurable: true,
		frames: frames.length,
		recordedS: seconds(analysis.recordedMs),
		changes: analysis.changes.map((c) => ({
			fromWidth: c.from.width,
			fromHeight: c.from.height,
			toWidth: c.to.width,
			toHeight: c.to.height,
			atS: seconds(c.atMs),
			pauseS: seconds(c.pauseMs),
			shapeFrom: c.shapeFrom,
			shapeTo: c.shapeTo
		})),
		longestPauseS: seconds(analysis.longestPauseMs),
		longestPauseAtS: seconds(analysis.longestPauseAtMs)
	};
}

export function runData({
	steps,
	answers,
	snapshots,
	startStep,
	startFrames,
	countdown
}: RunInput) {
	const questions = steps.flatMap((s) => [...(s.beforeWait ?? []), ...s.questions]);
	const start = snapshots[startStep];

	return {
		version: PROTOCOL_VERSION,
		answers: Object.fromEntries(
			questions.map((q) => [answerKey(q), answerValue(q, answers[q.name])])
		),
		camera: start
			? {
					maxWidth: start.cameraMaxWidth || null,
					maxHeight: start.cameraMaxHeight || null,
					maxFps: start.cameraMaxFps || null,
					zoomMin: start.zoomRange?.min ?? null,
					zoomMax: start.zoomRange?.max ?? null,
					settledWidth: start.trackWidth || null,
					settledHeight: start.trackHeight || null,
					outcome: start.upgradeState,
					countedFps: round(start.probedFps, 1)
				}
			: null,
		start: startData(startFrames),
		/** Camera detail behind each screen pixel, on each step it was read on. */
		detail: Object.fromEntries(
			Object.entries(snapshots).map(([id, s]) => [
				id,
				{
					sourcePerDevicePx: round(s.sourcePerDevicePx, 3),
					zoom: round(s.zoom, 2),
					width: s.trackWidth || null,
					height: s.trackHeight || null
				}
			])
		),
		countdown: countdown.ran
			? {
					screenStayedOn: countdown.hiddenWithLeft === null,
					hiddenWithLeftS: countdown.hiddenWithLeft,
					stoppedEarly: countdown.stoppedWithLeft !== null,
					stoppedWithLeftS: countdown.stoppedWithLeft
				}
			: null,
		device: start
			? {
					userAgent: start.userAgent,
					screenWidth: start.screenWidth,
					screenHeight: start.screenHeight,
					pixelRatio: round(start.devicePixelRatio, 2),
					wakeLock: start.wakeLockStatus
				}
			: null
	};
}

export type RunData = ReturnType<typeof runData>;
