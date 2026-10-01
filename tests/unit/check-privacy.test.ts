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

	it('flags any request from the mirror itself, same-origin included (rule 3)', () => {
		// An off-origin call breaks two rules at once: the mirror may not make a
		// request at all, and nothing anywhere may leave this origin.
		expect(scanText('lib/x.ts', "await fetch('https://example.com/t');")).toHaveLength(2);
		expect(scanText('lib/x.ts', "await fetch('/icons/icon-192.png');")).toHaveLength(1);
	});

	it('lets the service worker and the guided test make requests (rule 3)', () => {
		expect(scanText('service-worker.ts', 'return fetch(request);')).toEqual([]);
		expect(scanText('routes/test/+page.svelte', "await fetch('/', { method: 'POST' });")).toEqual(
			[]
		);
		// But the exception is for its own origin only.
		expect(
			scanText('routes/test/+page.svelte', "await fetch('https://example.com/');")
		).toHaveLength(1);
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
