/**
 * What happened to the picture while the camera started: each change of
 * resolution, and how long the picture paused around it.
 *
 * Recorded from the browser's per-frame callback, which says when each new
 * frame arrived and how big it is. No pixel is read, so whether the picture
 * went black or changed brightness cannot be told this way — that, and whether
 * a pause was noticeable at all, stays a question for the tester.
 */
import type { Reading } from './report';

export interface Frame {
	/** When the frame arrived, in milliseconds. */
	t: number;
	width: number;
	height: number;
}

/** How long to go on recording once the resolution probe has finished: the frames after the last change. */
export const WATCH_TAIL_MS = 2000;
/** Recording stops after this long whatever happens, so it cannot run on through the whole test. */
export const WATCH_MAX_MS = 15_000;
/** How often what has been recorded so far is handed over. */
const FLUSH_MS = 500;
/** A pause counts towards a resolution change when it is within this far of it. */
const AROUND_MS = 1000;

/**
 * Record the arrival time and size of every frame, until `settled()` has been
 * true for WATCH_TAIL_MS, or for WATCH_MAX_MS at most. `report` receives what
 * has been recorded so far every FLUSH_MS and once at the end — or `null` at
 * once, when the browser has no per-frame callback to record from.
 * Returns a function that ends the recording early.
 */
export function recordFrames(
	video: HTMLVideoElement,
	settled: () => boolean,
	report: (frames: Frame[] | null) => void
): () => void {
	const request = video.requestVideoFrameCallback?.bind(video);
	if (!request) {
		report(null);
		return () => {};
	}

	const frames: Frame[] = [];
	const started = performance.now();
	// The frame on screen as the recording starts. The probe asks for the new
	// resolution at this same moment, so the first frame the callback reports
	// can already be the new size; without this one there would be nothing to
	// compare it with, and the change up would go unrecorded.
	if (video.videoWidth && video.videoHeight) {
		frames.push({ t: started, width: video.videoWidth, height: video.videoHeight });
	}
	let settledAt: number | null = null;
	let stopped = false;
	let handle = 0;

	const stop = () => {
		if (stopped) return;
		stopped = true;
		clearInterval(flush);
		clearTimeout(limit);
		video.cancelVideoFrameCallback?.(handle);
		report([...frames]);
	};
	const flush = setInterval(() => report([...frames]), FLUSH_MS);
	// A stream that stops delivering frames never calls back, and must still end.
	const limit = setTimeout(stop, WATCH_MAX_MS);

	const tick: VideoFrameRequestCallback = (now, metadata) => {
		if (stopped) return;
		frames.push({
			t: now,
			width: metadata.width || video.videoWidth,
			height: metadata.height || video.videoHeight
		});
		if (settledAt === null && settled()) settledAt = now;
		const tailDone = settledAt !== null && now - settledAt >= WATCH_TAIL_MS;
		if (tailDone || now - started >= WATCH_MAX_MS) stop();
		else handle = request(tick);
	};
	handle = request(tick);
	return stop;
}

const seconds = (ms: number, places = 2) => `${(ms / 1000).toFixed(places)} s`;
const size = (f: { width: number; height: number }) => `${f.width}×${f.height}`;

/** The picture's shape as a ratio, the common ones by name: 16:9, 4:3, 9:16. */
export function shape(width: number, height: number): string {
	const ratio = Math.max(width, height) / Math.min(width, height);
	const known: [number, number][] = [
		[16, 9],
		[4, 3],
		[3, 2],
		[1, 1]
	];
	const match = known.find(([a, b]) => Math.abs(ratio - a / b) < 0.02);
	const [a, b] = match ?? [Number(ratio.toFixed(2)), 1];
	return width >= height ? `${a}:${b}` : `${b}:${a}`;
}

/** The longest gap between two frames that arrived in [from, to], and when it ended. */
function longestPause(frames: Frame[], from = -Infinity, to = Infinity) {
	let gap = 0;
	let end = frames[0].t;
	for (let i = 1; i < frames.length; i++) {
		if (frames[i].t < from || frames[i - 1].t > to) continue;
		const g = frames[i].t - frames[i - 1].t;
		if (g > gap) {
			gap = g;
			end = frames[i].t;
		}
	}
	return { gap, end };
}

/** One change of resolution, timed from the moment the picture appeared. */
export interface Change {
	from: { width: number; height: number };
	to: { width: number; height: number };
	/** When the first frame at the new size arrived. */
	atMs: number;
	/** The longest gap between frames within AROUND_MS of the change. */
	pauseMs: number;
	shapeFrom: string;
	shapeTo: string;
}

export interface StartAnalysis {
	changes: Change[];
	/** The longest gap between frames anywhere in the recording, and when it ended. */
	longestPauseMs: number;
	longestPauseAtMs: number;
	/** How long the recording covers. */
	recordedMs: number;
}

/** The recording as numbers, or `null` when fewer than two frames arrived. */
export function analyseStart(frames: Frame[]): StartAnalysis | null {
	if (frames.length < 2) return null;
	const first = frames[0].t;
	const changes = frames.flatMap((after, i): Change[] => {
		const before = frames[i - 1];
		if (!before || (before.width === after.width && before.height === after.height)) return [];
		return [
			{
				from: { width: before.width, height: before.height },
				to: { width: after.width, height: after.height },
				atMs: after.t - first,
				pauseMs: longestPause(frames, after.t - AROUND_MS, after.t + AROUND_MS).gap,
				shapeFrom: shape(before.width, before.height),
				shapeTo: shape(after.width, after.height)
			}
		];
	});
	const overall = longestPause(frames);
	return {
		changes,
		longestPauseMs: overall.gap,
		longestPauseAtMs: overall.end - first,
		recordedMs: frames[frames.length - 1].t - first
	};
}

const LABEL = 'Resolution changes while the camera started';

/**
 * The recording as report lines. `undefined`: nothing was recorded, so there is
 * nothing to say. `null`: this browser cannot be recorded from.
 */
export function startReadings(frames: Frame[] | null | undefined): Reading[] {
	if (frames === undefined) return [];
	if (frames === null) return [{ label: LABEL, value: 'not measurable in this browser' }];
	const analysis = analyseStart(frames);
	if (!analysis) return [{ label: LABEL, value: 'too few frames arrived to tell' }];

	const { changes } = analysis;
	const lines: Reading[] = [
		{ label: LABEL, value: changes.length > 0 ? String(changes.length) : 'none' }
	];
	changes.forEach((c, i) => {
		lines.push({
			label: `Resolution change ${i + 1}`,
			value:
				`${size(c.from)} → ${size(c.to)}, ${seconds(c.atMs, 1)} after the picture appeared, ` +
				`longest pause between frames around it ${seconds(c.pauseMs)}` +
				(c.shapeFrom === c.shapeTo ? '' : `, picture shape ${c.shapeFrom} → ${c.shapeTo}`)
		});
	});
	lines.push({
		label: `Longest pause between frames in the first ${seconds(analysis.recordedMs, 0)}`,
		value: `${seconds(analysis.longestPauseMs)}, ${seconds(analysis.longestPauseAtMs, 1)} after the picture appeared`
	});
	return lines;
}
