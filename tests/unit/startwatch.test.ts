import { describe, expect, it } from 'vitest';
import { shape, startReadings, type Frame } from '../../src/lib/test/startwatch';

/** Frames every `every` ms at one size, starting at `from`. */
const run = (from: number, count: number, width: number, height: number, every = 33): Frame[] =>
	Array.from({ length: count }, (_, i) => ({ t: from + i * every, width, height }));

const value = (lines: { label: string; value: string }[], label: string) =>
	lines.find((l) => l.label.startsWith(label))?.value;

describe('shape', () => {
	it('names the common shapes, either way round', () => {
		expect(shape(1920, 1080)).toBe('16:9');
		expect(shape(3840, 2880)).toBe('4:3');
		expect(shape(1080, 1920)).toBe('9:16');
		expect(shape(640, 640)).toBe('1:1');
	});

	it('falls back to a ratio for anything else', () => {
		expect(shape(2000, 1000)).toBe('2:1');
		expect(shape(1000, 1700)).toBe('1:1.7');
	});
});

describe('startReadings', () => {
	it('says nothing when nothing was recorded', () => {
		expect(startReadings(undefined)).toEqual([]);
	});

	it('says so when the browser cannot be recorded from', () => {
		expect(value(startReadings(null), 'Resolution changes')).toBe('not measurable in this browser');
	});

	it('does not guess from a single frame', () => {
		expect(value(startReadings(run(0, 1, 1920, 1080)), 'Resolution changes')).toBe(
			'too few frames arrived to tell'
		);
	});

	it('reports none when the size never changed', () => {
		const lines = startReadings(run(0, 60, 1920, 1080));
		expect(value(lines, 'Resolution changes')).toBe('none');
		expect(lines.some((l) => l.label.startsWith('Resolution change 1'))).toBe(false);
	});

	it('finds each change, when it happened, and the pause around it', () => {
		// 1080p, a 400 ms pause, 4K; then a 250 ms pause and back to 1080p.
		const frames = [
			...run(0, 30, 1920, 1080),
			...run(29 * 33 + 400, 60, 3840, 2160),
			...run(29 * 33 + 400 + 59 * 33 + 250, 30, 1920, 1080)
		];
		const lines = startReadings(frames);
		expect(value(lines, 'Resolution changes')).toBe('2');
		expect(value(lines, 'Resolution change 1')).toBe(
			'1920×1080 → 3840×2160, 1.4 s after the picture appeared, longest pause between frames around it 0.40 s'
		);
		expect(value(lines, 'Resolution change 2')).toContain('3840×2160 → 1920×1080');
		expect(value(lines, 'Resolution change 2')).toContain('around it 0.25 s');
		expect(value(lines, 'Longest pause')).toBe('0.40 s, 1.4 s after the picture appeared');
	});

	it('says when the picture changes shape, which makes it jump on screen', () => {
		const frames = [...run(0, 30, 1920, 1080), ...run(30 * 33, 30, 3840, 2880)];
		expect(value(startReadings(frames), 'Resolution change 1')).toContain(
			'picture shape 16:9 → 4:3'
		);
	});

	it('leaves the shape out when it stays the same', () => {
		const frames = [...run(0, 30, 1920, 1080), ...run(30 * 33, 30, 3840, 2160)];
		expect(value(startReadings(frames), 'Resolution change 1')).not.toContain('shape');
	});

	it('does not blame a change for a pause long before it', () => {
		// A 500 ms pause at 1 s, then a change at 5 s with steady frames around it.
		const frames = [
			...run(0, 30, 1920, 1080),
			...run(29 * 33 + 500, 100, 1920, 1080),
			...run(29 * 33 + 500 + 100 * 33, 30, 3840, 2160)
		];
		const lines = startReadings(frames);
		expect(value(lines, 'Resolution change 1')).toContain('around it 0.03 s');
		expect(value(lines, 'Longest pause')).toMatch(/^0\.50 s/);
	});
});
