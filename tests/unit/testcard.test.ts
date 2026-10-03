import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STEPS } from '../../src/lib/test/protocol';

const linked = STEPS.flatMap((s) => (s.link ? [s.link.href] : []));

describe('the test card the first step links to', () => {
	it('is a file the site actually serves', () => {
		expect(linked).toEqual(['/testcard.pdf']);
		for (const href of linked) expect(existsSync(`static${href}`), href).toBe(true);
	});

	it('is one A4 page, so a printer at 100 % keeps every size on it', () => {
		const pdf = readFileSync('static/testcard.pdf').toString('latin1');
		expect(pdf.startsWith('%PDF-')).toBe(true);
		expect(pdf.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
		const [, , width, height] = /\/MediaBox\s*\[([^\]]*)\]/
			.exec(pdf)![1]
			.trim()
			.split(/\s+/)
			.map(Number);
		// A4 is 595.28 × 841.89 points; Chromium rounds to whole pixels.
		expect(Math.abs(width - 595.28)).toBeLessThan(1);
		expect(Math.abs(height - 841.89)).toBeLessThan(1);
	});
});
