import { describe, expect, it } from 'vitest';
import { answerKey, answerValue, runData, type RunInput } from '../../src/lib/test/data';
import { PROTOCOL_VERSION, STEPS, type Question } from '../../src/lib/test/protocol';
import type { Snapshot } from '../../src/lib/test/readings';
import type { Frame } from '../../src/lib/test/startwatch';

const allQuestions = STEPS.flatMap((s) => [...(s.beforeWait ?? []), ...s.questions]);
const question = (name: string) => allQuestions.find((q) => q.name === name)!;

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
	cameraMaxWidth: 3840,
	cameraMaxHeight: 2160,
	cameraMaxFps: 20,
	zoomRange: null,
	trackWidth: 1920,
	trackHeight: 1080,
	trackFps: 20,
	upgradeState: 'fellback',
	probedFps: 16.54,
	sourcePerDevicePx: 0.6543,
	zoom: 5,
	screenWidth: 390,
	screenHeight: 844,
	devicePixelRatio: 3,
	wakeLockStatus: 'held',
	userAgent: 'Mozilla/5.0 (iPhone)',
	...over
});

const input = (over: Partial<RunInput> = {}): RunInput => ({
	steps: STEPS,
	answers: {},
	snapshots: {},
	startStep: 'start',
	startFrames: undefined,
	countdown: { ran: false, hiddenWithLeft: null, stoppedWithLeft: null },
	...over
});

describe('the keys answers are sent under', () => {
	it('put the unit in the key, so a column says what it holds', () => {
		expect(answerKey(question('batteryBefore'))).toBe('batteryBefore_pct');
		expect(answerKey(question('batteryAfter'))).toBe('batteryAfter_pct');
		expect(answerKey(question('sharp'))).toBe('sharp');
	});

	it('are all different, across the whole test', () => {
		const keys = allQuestions.map(answerKey);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe('the values answers are sent as', () => {
	it('come from the option picked, not its wording', () => {
		expect(answerValue(question('lightDark'), '2 — usable')).toBe(2);
		expect(answerValue(question('sharp'), 'yes')).toBe(true);
		expect(answerValue(question('sharp'), 'no')).toBe(false);
		expect(answerValue(question('driftAlone'), 'moved a little')).toBe('little');
		expect(answerValue(question('driftNudge'), 'annoying')).toBe('annoying');
		expect(answerValue(question('warmth'), 'warm')).toBe('warm');
	});

	it('tell an answer of "none" apart from no answer at all', () => {
		expect(answerValue(question('driftAlone'), 'not moved')).toBe('none');
		expect(answerValue(question('driftAlone'), undefined)).toBeNull();
		expect(answerValue(question('driftAlone'), '  ')).toBeNull();
	});

	it('read a typed number as a number, forgiving a % sign or a decimal comma', () => {
		const battery = question('batteryBefore');
		expect(answerValue(battery, '78')).toBe(78);
		expect(answerValue(battery, ' 78 % ')).toBe(78);
		expect(answerValue(battery, '7,5')).toBe(7.5);
	});

	it('keep what was typed when it is not a number, rather than lose it', () => {
		expect(answerValue(question('batteryAfter'), 'about seventy')).toBe('about seventy');
	});

	it('keep free text as it was written', () => {
		expect(answerValue(question('phone'), ' iPhone 14 Pro ')).toBe('iPhone 14 Pro');
	});

	it('give every option of a question its own wording and its own value', () => {
		for (const q of allQuestions.filter(
			(q): q is Question & { kind: 'choice' } => q.kind === 'choice'
		)) {
			expect(new Set(q.options.map((o) => o.label)).size, q.name).toBe(q.options.length);
			expect(new Set(q.options.map((o) => o.value)).size, q.name).toBe(q.options.length);
		}
	});
});

describe('runData', () => {
	it('says which version of the test it came from', () => {
		expect(runData(input()).version).toBe(PROTOCOL_VERSION);
	});

	it('files every question, the ones before the countdown included, answered or not', () => {
		const data = runData(input({ answers: { sharp: 'yes', batteryBefore: '78' } }));
		expect(Object.keys(data.answers)).toHaveLength(allQuestions.length);
		expect(data.answers.sharp).toBe(true);
		expect(data.answers.batteryBefore_pct).toBe(78);
		expect(data.answers.lightDark).toBeNull();
	});

	it('takes the camera and the device from the starting step, as numbers', () => {
		const data = runData(input({ snapshots: { start: snapshot() } }));
		expect(data.camera).toEqual({
			maxWidth: 3840,
			maxHeight: 2160,
			maxFps: 20,
			zoomMin: null,
			zoomMax: null,
			settledWidth: 1920,
			settledHeight: 1080,
			outcome: 'fellback',
			countedFps: 16.5
		});
		expect(data.device).toMatchObject({ screenWidth: 390, pixelRatio: 3, wakeLock: 'held' });
	});

	it('leaves the camera out, rather than inventing it, when it was never read', () => {
		expect(runData(input()).camera).toBeNull();
		expect(runData(input()).device).toBeNull();
	});

	it('keeps the camera detail of every step it was read on', () => {
		const data = runData(input({ snapshots: { card: snapshot() } }));
		expect(data.detail.card).toEqual({
			sourcePerDevicePx: 0.654,
			zoom: 5,
			width: 1920,
			height: 1080
		});
	});

	it('records the resolution changes in seconds', () => {
		const frames: Frame[] = [
			{ t: 1000, width: 1920, height: 1080 },
			{ t: 1150, width: 3840, height: 2160 },
			{ t: 1200, width: 3840, height: 2160 }
		];
		const start = runData(input({ startFrames: frames })).start;
		expect(start).toMatchObject({ measurable: true, frames: 3, longestPauseS: 0.15 });
		expect(start && 'changes' in start && start.changes).toEqual([
			{
				fromWidth: 1920,
				fromHeight: 1080,
				toWidth: 3840,
				toHeight: 2160,
				atS: 0.15,
				pauseS: 0.15,
				shapeFrom: '16:9',
				shapeTo: '16:9'
			}
		]);
	});

	it('says when the start could not be recorded, and says nothing when it was not', () => {
		expect(runData(input({ startFrames: null })).start).toEqual({ measurable: false });
		expect(runData(input({ startFrames: undefined })).start).toBeNull();
	});

	it('records the countdown only when one ran', () => {
		expect(runData(input()).countdown).toBeNull();
		const ran = runData(
			input({ countdown: { ran: true, hiddenWithLeft: 252, stoppedWithLeft: null } })
		);
		expect(ran.countdown).toEqual({
			screenStayedOn: false,
			hiddenWithLeftS: 252,
			stoppedEarly: false,
			stoppedWithLeftS: null
		});
	});

	it('survives a trip through JSON unchanged: no NaN, no undefined', () => {
		const data = runData(
			input({
				snapshots: { start: snapshot({ probedFps: Number.NaN }) },
				startFrames: [{ t: 0, width: 1, height: 1 }],
				countdown: { ran: true, hiddenWithLeft: null, stoppedWithLeft: 590 }
			})
		);
		expect(JSON.parse(JSON.stringify(data))).toEqual(data);
		expect(data.camera?.countedFps).toBeNull();
	});
});
