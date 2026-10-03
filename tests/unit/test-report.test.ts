import { describe, expect, it } from 'vitest';
import {
	counterText,
	isLastStep,
	raisedFrom,
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
	waitReadings,
	type Snapshot
} from '../../src/lib/test/readings';

const step = STEPS.find((s) => s.id === 'light')!;

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

	it('only ever asks for a magnification the mirror can reach', () => {
		for (const s of STEPS) if (s.zoom !== undefined) expect(s.zoom).toBeLessThanOrEqual(5);
	});

	it('asks about the card, magnified to the most: the smallest line made sharp, and how far', () => {
		const card = STEPS.find((s) => s.id === 'card')!;
		expect(card.zoom).toBe(5);
		expect(card.questions.map((q) => q.name)).toEqual(['textSharp', 'sharpestAt']);
		const distance = card.questions[1];
		expect(distance.kind === 'text' && distance.numeric && distance.unit).toBe('cm');
	});

	it('offers every text size printed on the card, and none of them', () => {
		const [sizes] = STEPS.find((s) => s.id === 'card')!.questions;
		expect(sizes.kind === 'choice' && sizes.options.map((o) => o.label)).toEqual([
			...TEXT_HEIGHTS.map((h) => `${h} mm`),
			'none of them'
		]);
	});

	it('asks how hard it was to put the picture back after a nudge, with nothing else to pick', () => {
		const nudge = STEPS.flatMap((s) => s.questions).find((q) => q.name === 'driftNudge')!;
		expect(nudge.kind === 'choice' && nudge.options.map((o) => o.label)).toEqual([
			'easy',
			'annoying'
		]);
	});

	it('knows which step is the last one', () => {
		expect(isLastStep(STEPS.length - 1)).toBe(true);
		expect(isLastStep(0)).toBe(false);
	});
});

describe('the resolution probe', () => {
	it('reads its outcome as kept, not kept, or not known yet', () => {
		expect(raisedFrom('upgraded')).toBe(true);
		expect(raisedFrom('fellback')).toBe(false);
		expect(raisedFrom('unavailable')).toBe(false);
		expect(raisedFrom('skipped')).toBe(false);
		expect(raisedFrom('probing')).toBeNull();
		expect(raisedFrom('idle')).toBeNull();
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
	it('counts against all five steps', () => {
		expect(counterText('phone')).toBe('Step 1 of 5');
		expect(counterText('card')).toBe('Step 3 of 5');
		expect(counterText('ten-minutes')).toBe('Step 5 of 5');
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
	const all = { lightDark: '1 — not enough', lightRoom: '3 — plenty' };

	it('names every question still blank', () => {
		expect(unanswered(step, {})).toEqual(['lightDark', 'lightRoom']);
	});

	it('does not accept a space as an answer', () => {
		expect(unanswered(step, { ...all, lightRoom: '  ' })).toEqual(['lightRoom']);
	});

	it('is empty once all of them are answered', () => {
		expect(unanswered(step, all)).toEqual([]);
	});
});

describe('formatReport', () => {
	const report: Report = {
		answers: { phone: 'iPhone 14 Pro', lightDark: '2 — usable' },
		readings: [{ label: 'Frames per second it counted', value: '29.8' }]
	};

	it('keeps an unanswered question in, rather than hiding the gap', () => {
		const text = formatReport(STEPS, report);
		expect(text).toContain('Smallest line you can get sharp: (not answered)');
	});

	it('carries the answers and the measurements', () => {
		const text = formatReport(STEPS, report);
		expect(text).toContain('iPhone 14 Pro');
		expect(text).toContain('2 — usable');
		expect(text).toContain('29.8');
	});

	it('leaves out the measurement heading when there is nothing under it', () => {
		const text = formatReport(STEPS, { answers: {}, readings: [] });
		expect(text).not.toContain('Measured by the app');
	});

	it('labels the lines with the question, not the field name', () => {
		expect(stepLines(step, { lightDark: '2 — usable' })).toContain(
			'  Darken the room. Is there enough light on the card?: 2 — usable'
		);
	});
});

describe('readingsInOrder', () => {
	const reading = (label: string) => ({ label, value: '1' });

	it('lists the readings in the order of the steps, not the order they were taken', () => {
		const byStep = { card: [reading('card')], start: [reading('camera')] };
		expect(readingsInOrder(STEPS, byStep).map((r) => r.label)).toEqual(['camera', 'card']);
	});

	it('holds one set per step, so a step measured again is listed once', () => {
		let byStep: Record<string, ReturnType<typeof reading>[]> = {};
		byStep = { ...byStep, card: [reading('first time')] };
		byStep = { ...byStep, card: [reading('second time')] };
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
		const data = JSON.stringify({ version: 1, answers: { textSharp_mm: 1.5 } });
		const body = new URLSearchParams(submissionBody('f', 'p', 's', data));
		expect(JSON.parse(body.get('data')!)).toEqual({
			version: 1,
			answers: { textSharp_mm: 1.5 }
		});
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
