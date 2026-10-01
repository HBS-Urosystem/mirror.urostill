import { describe, expect, it } from 'vitest';
import { BAR_WIDTHS, STEPS, TEXT_HEIGHTS, isLastStep } from '../../src/lib/test/protocol';
import {
	formatReport,
	stepLines,
	submissionBody,
	unanswered,
	type Report
} from '../../src/lib/test/report';
import { detailReading, deviceReadings, type Snapshot } from '../../src/lib/test/readings';

const step = STEPS.find((s) => s.id === 'focus')!;

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

	it('gives every question a name of its own', () => {
		const names = STEPS.flatMap((s) => s.questions.map((q) => q.name));
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
		const bars = STEPS.find((s) => s.id === 'bars-best')!.questions[0];
		const text = STEPS.find((s) => s.id === 'text-best')!.questions[0];
		expect(bars.kind === 'choice' && bars.options).toHaveLength(BAR_WIDTHS.length + 1);
		expect(text.kind === 'choice' && text.options).toHaveLength(TEXT_HEIGHTS.length + 1);
	});

	it('knows which step is the last one', () => {
		expect(isLastStep(STEPS.length - 1)).toBe(true);
		expect(isLastStep(0)).toBe(false);
	});
});

describe('unanswered', () => {
	it('names every question still blank', () => {
		expect(unanswered(step, {})).toEqual(['sharp30', 'sharp35', 'sharp45']);
	});

	it('does not accept a space as an answer', () => {
		expect(unanswered(step, { sharp30: '  ', sharp35: 'yes', sharp45: 'no' })).toEqual(['sharp30']);
	});

	it('is empty once all three are answered', () => {
		expect(unanswered(step, { sharp30: 'yes', sharp35: 'yes', sharp45: 'no' })).toEqual([]);
	});
});

describe('formatReport', () => {
	const report: Report = {
		answers: { phone: 'iPhone 14 Pro', sharp30: 'yes', barsBest: '0.25 mm' },
		readings: [{ label: 'Frames per second it counted', value: '29.8' }],
		problems: ['The screen went dark.']
	};

	it('keeps an unanswered question in, rather than hiding the gap', () => {
		const text = formatReport(STEPS, report);
		expect(text).toContain('Sharp at 45 cm?: (not answered)');
	});

	it('carries the answers, the measurements and the problems', () => {
		const text = formatReport(STEPS, report);
		expect(text).toContain('iPhone 14 Pro');
		expect(text).toContain('0.25 mm');
		expect(text).toContain('29.8');
		expect(text).toContain('The screen went dark.');
	});

	it('leaves out the measurement and problem headings when there are none', () => {
		const text = formatReport(STEPS, { answers: {}, readings: [], problems: [] });
		expect(text).not.toContain('Measured by the app');
		expect(text).not.toContain('Problems during the run');
	});

	it('labels the lines with the question, not the field name', () => {
		expect(stepLines(step, { sharp30: 'yes' })[0]).toBe('  Sharp at 30 cm?: yes');
	});
});

describe('submissionBody', () => {
	it('names the form, or Netlify will not take it', () => {
		const body = new URLSearchParams(submissionBody('mirror-test', 'iPhone', 'all of it'));
		expect(body.get('form-name')).toBe('mirror-test');
		expect(body.get('phone')).toBe('iPhone');
		expect(body.get('summary')).toBe('all of it');
	});

	it('says so rather than sending an empty phone', () => {
		expect(new URLSearchParams(submissionBody('f', '   ', 's')).get('phone')).toBe('not given');
	});

	it('survives newlines and accented letters', () => {
		const summary = 'első sor\nmásodik sor';
		expect(new URLSearchParams(submissionBody('f', 'p', summary)).get('summary')).toBe(summary);
	});
});

describe('readings', () => {
	it('reports the camera maximum and the mode it settled on', () => {
		const lines = deviceReadings(snapshot());
		const text = lines.map((r) => `${r.label}: ${r.value}`).join('\n');
		expect(text).toContain('4032×3024 at 60 fps');
		expect(text).toContain('3840×2880, upgraded');
		expect(text).toContain('1–10');
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
		const reading = detailReading('Bars, best quality', snapshot());
		expect(reading.label).toContain('bars, best quality');
		expect(reading.label).toContain('3× magnified');
		expect(reading.label).toContain('3840×2880');
		expect(reading.value).toBe('1.94');
	});
});
