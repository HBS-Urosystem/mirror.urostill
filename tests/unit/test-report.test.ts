import { describe, expect, it } from 'vitest';
import {
	adaptSteps,
	BAR_WIDTHS,
	counterText,
	isLastStep,
	raisedFrom,
	skipReason,
	STEPS,
	TEXT_HEIGHTS
} from '../../src/lib/test/protocol';
import {
	formatReport,
	readingsInOrder,
	stepLines,
	submissionBody,
	unanswered,
	type Report
} from '../../src/lib/test/report';
import {
	clock,
	detailReading,
	deviceReadings,
	focusReading,
	waitReadings,
	type Snapshot
} from '../../src/lib/test/readings';

const step = STEPS.find((s) => s.id === 'card-best')!;

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
	cameraMaxWidth: 4032,
	cameraMaxHeight: 3024,
	cameraMaxFps: 60,
	zoomRange: { min: 1, max: 10 },
	trackWidth: 3840,
	trackHeight: 2880,
	trackFps: 30,
	upgradeState: 'upgraded',
	probedFps: 29.84,
	sourcePerDevicePx: 1.94,
	zoom: 3,
	screenWidth: 393,
	screenHeight: 852,
	devicePixelRatio: 3,
	wakeLockStatus: 'held',
	userAgent: 'Mozilla/5.0 (iPhone)',
	focusDistance: null,
	focusReported: false,
	...over
});

describe('protocol', () => {
	it('asks for the phone before it needs the camera', () => {
		const firstCamera = STEPS.findIndex((s) => s.needsCamera);
		expect(STEPS.findIndex((s) => s.id === 'phone')).toBeLessThan(firstCamera);
	});

	it('gives every question a name of its own, the ones before a countdown included', () => {
		const names = STEPS.flatMap((s) =>
			[...(s.beforeWait ?? []), ...s.questions].map((q) => q.name)
		);
		expect(new Set(names).size).toBe(names.length);
	});

	it('measures the card at both resolutions, otherwise there is nothing to compare', () => {
		const measured = STEPS.filter((s) => s.resolution && s.zoom);
		expect(measured.some((s) => s.resolution === 'settled')).toBe(true);
		expect(measured.some((s) => s.resolution === 'base')).toBe(true);
	});

	it('only ever asks for a magnification the mirror can reach', () => {
		for (const s of STEPS) if (s.zoom !== undefined) expect(s.zoom).toBeLessThanOrEqual(5);
	});

	it('offers every width and height that is printed on the card', () => {
		const bars = step.questions[0];
		const text = step.questions[1];
		expect(bars.kind === 'choice' && bars.options).toHaveLength(BAR_WIDTHS.length + 1);
		expect(text.kind === 'choice' && text.options).toHaveLength(TEXT_HEIGHTS.length + 1);
	});

	it('knows which step is the last one', () => {
		expect(isLastStep(STEPS.length - 1)).toBe(true);
		expect(isLastStep(0)).toBe(false);
	});
});

describe('a camera that did not keep a higher resolution', () => {
	const byId = (steps: typeof STEPS, id: string) => steps.find((s) => s.id === id)!;

	it('reads the probe outcome as kept, not kept, or not known yet', () => {
		expect(raisedFrom('upgraded')).toBe(true);
		expect(raisedFrom('fellback')).toBe(false);
		expect(raisedFrom('unavailable')).toBe(false);
		expect(raisedFrom('skipped')).toBe(false);
		expect(raisedFrom('probing')).toBeNull();
		expect(raisedFrom('idle')).toBeNull();
	});

	it('leaves out the two 1920×1080 steps, and nothing else', () => {
		const left = STEPS.filter((s) => skipReason(s, false) !== null).map((s) => s.id);
		expect(left).toEqual(['card-base']);
	});

	it('leaves everything in while the outcome is unknown, or when it was kept', () => {
		expect(STEPS.filter((s) => skipReason(s, null) !== null)).toEqual([]);
		expect(STEPS.filter((s) => skipReason(s, true) !== null)).toEqual([]);
	});

	it('stops calling the first round "high resolution", and tells the tester nothing else', () => {
		const adapted = adaptSteps(STEPS, false);
		expect(byId(adapted, 'card-best').title).toBe('Card');
		// What the camera did is a result for the report, not news for the tester.
		expect(byId(adapted, 'card-best').instructions).toEqual(byId(STEPS, 'card-best').instructions);
	});

	it('changes nothing when the camera kept the higher resolution', () => {
		expect(adaptSteps(STEPS, true)).toBe(STEPS);
		expect(adaptSteps(STEPS, null)).toBe(STEPS);
	});

	it('explains a skipped step in the report instead of listing it as unanswered', () => {
		const skipped = { 'card-base': skipReason(byId(STEPS, 'card-base'), false)! };
		const text = formatReport([byId(STEPS, 'card-base')], { answers: {}, readings: [], skipped });
		expect(text).toContain('Card, 1920×1080');
		expect(text).toContain('Skipped: the camera did not keep a higher resolution');
		expect(text).not.toContain('(not answered)');
	});

	it('knows the last step of a shortened list', () => {
		const shown = STEPS.filter((s) => skipReason(s, false) === null);
		expect(isLastStep(shown.length - 1, shown)).toBe(true);
		expect(isLastStep(STEPS.length - 1, shown)).toBe(false);
	});
});

describe('the battery percentage around the ten minutes', () => {
	const tenMinutes = STEPS.find((s) => s.id === 'ten-minutes')!;

	it('is asked before the countdown, and nothing else is', () => {
		expect(tenMinutes.beforeWait?.map((q) => q.name)).toEqual(['batteryBefore']);
	});

	it('is asked again straight after the one check that must come before the phone is touched', () => {
		expect(tenMinutes.questions.slice(0, 2).map((q) => q.name)).toEqual([
			'driftAlone',
			'batteryAfter'
		]);
	});

	it('brings up the number keypad both times', () => {
		const after = tenMinutes.questions.find((q) => q.name === 'batteryAfter')!;
		const both = [...tenMinutes.beforeWait!, after];
		expect(both.every((q) => q.kind === 'text' && q.numeric)).toBe(true);
	});

	it('will not start the countdown without the first reading', () => {
		const before = { questions: tenMinutes.beforeWait! };
		expect(unanswered(before, {})).toEqual(['batteryBefore']);
		expect(unanswered(before, { batteryBefore: '78' })).toEqual([]);
	});

	it('reports both readings under the step, the first one first', () => {
		const lines = stepLines(tenMinutes, { batteryBefore: '78', batteryAfter: '71' });
		expect(lines[0]).toBe('  Battery percentage now, before the countdown: 78');
		expect(lines).toContain('  Battery percentage now, after the countdown: 71');
	});
});

describe('the step counter', () => {
	it('counts against all six steps, whatever this phone skips', () => {
		expect(counterText('phone', false)).toBe('Step 1 of 6');
		expect(counterText('ten-minutes', true)).toBe('Step 6 of 6');
	});

	it('mentions nothing before the skipped step has been reached', () => {
		expect(counterText('card-best', false)).toBe('Step 3 of 6');
	});

	it('says how many were skipped once they are behind the tester', () => {
		expect(counterText('light', false)).toBe('Step 5 of 6 (1 skipped)');
		expect(counterText('ten-minutes', false)).toBe('Step 6 of 6 (1 skipped)');
	});

	it('mentions nothing when the camera kept the higher resolution, or before that is known', () => {
		expect(counterText('light', true)).toBe('Step 5 of 6');
		expect(counterText('light', null)).toBe('Step 5 of 6');
	});
});

describe('optional answers', () => {
	const start = STEPS.find((s) => s.id === 'start')!;
	const last = STEPS.find((s) => s.id === 'ten-minutes')!;

	it('does not make the tester describe something they did not see', () => {
		expect(unanswered(start, { flicker: 'no' })).toEqual([]);
	});

	it('still insists on the question that is actually being asked', () => {
		expect(unanswered(start, { flickerWhat: 'a flash' })).toEqual(['flicker']);
	});

	it('lets the closing box be left empty', () => {
		const required = Object.fromEntries(
			last.questions.filter((q) => !q.optional).map((q) => [q.name, 'x'])
		);
		expect(last.questions.some((q) => q.name === 'notes' && q.optional)).toBe(true);
		expect(unanswered(last, required)).toEqual([]);
	});

	it('sends the blank as a blank rather than dropping the question', () => {
		const text = formatReport([start], { answers: { flicker: 'no' }, readings: [] });
		expect(text).toContain('what happened, and how many times');
		expect(text).toContain('(left blank)');
		// Not to be mistaken for a question the tester skipped.
		expect(text).not.toContain('(not answered)');
	});
});

describe('the warning that has to come before the camera', () => {
	it('is on the step before the camera starts, not on the step after', () => {
		const phone = STEPS.find((s) => s.id === 'phone')!;
		const start = STEPS.find((s) => s.id === 'start')!;
		expect(phone.before).toContain('Watch the picture');
		expect(start.before).toBeUndefined();
	});

	it('asks what was seen without asking when, which needs a stopwatch', () => {
		const labels = STEPS.find((s) => s.id === 'start')!.questions.map((q) => q.label);
		expect(labels.join(' ')).not.toMatch(/how far in|seconds in|how long/i);
	});
});

describe('unanswered', () => {
	const all = { barsBest: '0.30 mm', textBest: '1.50 mm', sharp30: 'yes', sharp45: 'no' };

	it('names every question still blank', () => {
		expect(unanswered(step, {})).toEqual(['barsBest', 'textBest', 'sharp30', 'sharp45']);
	});

	it('does not accept a space as an answer', () => {
		expect(unanswered(step, { ...all, sharp30: '  ' })).toEqual(['sharp30']);
	});

	it('is empty once all of them are answered', () => {
		expect(unanswered(step, all)).toEqual([]);
	});
});

describe('formatReport', () => {
	const report: Report = {
		answers: { phone: 'iPhone 14 Pro', sharp30: 'yes', barsBest: '0.25 mm' },
		readings: [{ label: 'Frames per second it counted', value: '29.8' }]
	};

	it('keeps an unanswered question in, rather than hiding the gap', () => {
		const text = formatReport(STEPS, report);
		expect(text).toContain(
			'Now take it to 45 cm. Is the text as sharp as at 35 cm?: (not answered)'
		);
	});

	it('carries the answers and the measurements', () => {
		const text = formatReport(STEPS, report);
		expect(text).toContain('iPhone 14 Pro');
		expect(text).toContain('0.25 mm');
		expect(text).toContain('29.8');
	});

	it('leaves out the measurement heading when there is nothing under it', () => {
		const text = formatReport(STEPS, { answers: {}, readings: [] });
		expect(text).not.toContain('Measured by the app');
	});

	it('labels the lines with the question, not the field name', () => {
		expect(stepLines(step, { sharp30: 'yes' })).toContain(
			'  Bring the card to 30 cm. Is the text as sharp as at 35 cm?: yes'
		);
	});
});

describe('readingsInOrder', () => {
	const reading = (label: string) => ({ label, value: '1' });

	it('lists the readings in the order of the steps, not the order they were taken', () => {
		const byStep = { 'card-best': [reading('card')], start: [reading('camera')] };
		expect(readingsInOrder(STEPS, byStep).map((r) => r.label)).toEqual(['camera', 'card']);
	});

	it('holds one set per step, so a step measured again is listed once', () => {
		let byStep: Record<string, ReturnType<typeof reading>[]> = {};
		byStep = { ...byStep, 'card-best': [reading('first time')] };
		byStep = { ...byStep, 'card-best': [reading('second time')] };
		expect(readingsInOrder(STEPS, byStep).map((r) => r.label)).toEqual(['second time']);
	});

	it('ignores readings filed under a step that is not in the list', () => {
		expect(readingsInOrder(STEPS, { nowhere: [reading('stray')] })).toEqual([]);
	});
});

describe('what the app records about the countdown', () => {
	it('shows the time the way the countdown does', () => {
		expect(clock(600)).toBe('10:00');
		expect(clock(65)).toBe('1:05');
		expect(clock(0)).toBe('0:00');
	});

	it('says the screen stayed on and the countdown ran out, when they did', () => {
		expect(waitReadings(null, null).map((r) => r.value)).toEqual(['yes', 'ran to zero']);
	});

	it('says when the screen went off, by the time that was left', () => {
		expect(waitReadings(252, null)[0].value).toBe(
			'no, the screen went off or the app was left with 4:12 to go'
		);
	});

	it('says when the countdown was stopped early', () => {
		expect(waitReadings(null, 590)[1].value).toBe('stopped early with 9:50 to go');
	});
});

describe('what the tester is no longer asked', () => {
	it('does not ask whether the screen stayed on: they were not watching, and the app records it', () => {
		const names = STEPS.flatMap((s) =>
			[...(s.beforeWait ?? []), ...s.questions].map((q) => q.name)
		);
		expect(names).not.toContain('stayedOn');
	});

	it('darkens the panel only where it would add to the light being judged', () => {
		expect(STEPS.filter((s) => s.darkSheet).map((s) => s.id)).toEqual(['light']);
	});
});

describe('submissionBody', () => {
	it('names the form, or Netlify will not take it', () => {
		const body = new URLSearchParams(submissionBody('mirror-test', 'iPhone', 'all of it', '{}'));
		expect(body.get('form-name')).toBe('mirror-test');
		expect(body.get('phone')).toBe('iPhone');
		expect(body.get('summary')).toBe('all of it');
	});

	it('sends the data for analysis next to the readable summary', () => {
		const data = JSON.stringify({ version: 1, answers: { barsBest_mm: 0.3 } });
		const body = new URLSearchParams(submissionBody('f', 'p', 's', data));
		expect(JSON.parse(body.get('data')!)).toEqual({ version: 1, answers: { barsBest_mm: 0.3 } });
	});

	it('says so rather than sending an empty phone', () => {
		expect(new URLSearchParams(submissionBody('f', '   ', 's', '{}')).get('phone')).toBe(
			'not given'
		);
	});

	it('survives newlines and accented letters', () => {
		const summary = 'első sor\nmásodik sor';
		expect(new URLSearchParams(submissionBody('f', 'p', summary, '{}')).get('summary')).toBe(
			summary
		);
	});
});

describe('readings', () => {
	it('reports the camera maximum and the mode it settled on', () => {
		const lines = deviceReadings(snapshot());
		const text = lines.map((r) => `${r.label}: ${r.value}`).join('\n');
		expect(text).toContain('4032×3024 at 60 fps');
		expect(text).toContain('3840×2880 (raised and kept)');
		expect(text).toContain('1–10');
	});

	it('says in words what happened to the resolution, not the internal state name', () => {
		const settled = (state: string) =>
			deviceReadings(snapshot({ upgradeState: state })).find((r) =>
				r.label.startsWith('Resolution')
			)!.value;
		expect(settled('fellback')).toContain('set back for too few frames a second');
		expect(settled('unavailable')).toContain('not raised');
		// A state added later still shows up, under its own name.
		expect(settled('something-new')).toContain('something-new');
	});

	it('says whether the camera reports how far it is focused', () => {
		const said = (reported: boolean) =>
			deviceReadings(snapshot({ focusReported: reported })).find((r) =>
				r.label.startsWith('Reports how far')
			)!.value;
		expect(said(true)).toBe('yes');
		expect(said(false)).toBe('no');
	});

	it('records the focus distance on a step only where the camera gave one', () => {
		expect(focusReading('Card', snapshot())).toBeNull();
		expect(focusReading('Card', snapshot({ focusDistance: 0.346 }))).toEqual({
			label: 'Camera focused at — card',
			value: '35 cm'
		});
	});

	it('says what it found rather than printing a blank when there is no hardware zoom', () => {
		const lines = deviceReadings(snapshot({ zoomRange: null }));
		expect(lines.find((r) => r.label.includes('zoom'))?.value).toBe('none offered');
	});

	it('writes unknown rather than 0×0 when the camera reports nothing', () => {
		const lines = deviceReadings(snapshot({ cameraMaxWidth: 0, cameraMaxHeight: 0 }));
		expect(lines.find((r) => r.label.includes('at most'))?.value).toContain('unknown');
	});

	it('writes ? rather than NaN when the frame rate could not be counted', () => {
		const lines = deviceReadings(snapshot({ probedFps: Number.NaN }));
		expect(lines.find((r) => r.label.includes('Frames'))?.value).toBe('?');
	});

	it('records the magnification and the resolution alongside the detail figure', () => {
		const reading = detailReading('Bars, high resolution', snapshot());
		expect(reading.label).toContain('bars, high resolution');
		expect(reading.label).toContain('3× magnified');
		expect(reading.label).toContain('3840×2880');
		expect(reading.value).toBe('1.94');
	});
});
