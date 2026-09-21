import { describe, expect, it } from 'vitest';
import { scanText } from '../../scripts/check-privacy.mjs';

describe('check:privacy', () => {
	it('passes clean code', () => {
		expect(scanText('lib/camera.svelte.ts', 'const stream = await getUserMedia();')).toEqual([]);
	});

	it('flags capture APIs (rule 1)', () => {
		const found = scanText('lib/x.ts', 'canvas.toBlob((b) => save(b));');
		expect(found.map((f) => f.rule)).toEqual([1]);
	});

	it('flags persistence (rule 2)', () => {
		const found = scanText('lib/x.ts', "localStorage.setItem('halo', 'bright');");
		expect(found.map((f) => f.rule)).toEqual([2]);
	});

	it('flags an absolute fetch but not a same-origin one (rule 3)', () => {
		expect(scanText('lib/x.ts', "await fetch('https://example.com/t');")).toHaveLength(1);
		expect(scanText('lib/x.ts', "await fetch('/icons/icon-192.png');")).toEqual([]);
	});

	it('allows pixel reads only under src/lib/motion/ (rule 4)', () => {
		expect(scanText('lib/motion/sampler.ts', 'ctx.getImageData(0, 0, 192, 144);')).toEqual([]);
		expect(scanText('lib/components/Mirror.svelte', 'ctx.getImageData(0, 0, 8, 8);')).toHaveLength(
			1
		);
	});

	it('reports the line number and the offending text', () => {
		const [finding] = scanText('lib/x.ts', 'const a = 1;\nnew MediaRecorder(stream);');
		expect(finding).toMatchObject({ line: 2, match: 'MediaRecorder', rule: 1 });
	});
});
