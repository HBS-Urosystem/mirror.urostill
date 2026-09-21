import { describe, expect, it } from 'vitest';
import { fill, pickLang, STRINGS } from '../../src/lib/i18n';

describe('pickLang', () => {
	it.each(['hu', 'hu-HU', 'HU', 'hu-hu'])('picks Hungarian for %s', (tag) => {
		expect(pickLang(tag)).toBe('hu');
	});

	it.each(['en', 'en-GB', 'de-DE', 'hup-US', '', null, undefined])(
		'falls back to English for %s',
		(tag) => {
			expect(pickLang(tag)).toBe('en');
		}
	);
});

describe('STRINGS', () => {
	it('has the same keys in both languages', () => {
		expect(Object.keys(STRINGS.hu).sort()).toEqual(Object.keys(STRINGS.en).sort());
	});

	it('leaves no string empty', () => {
		const empty = Object.values(STRINGS).flatMap((strings) =>
			Object.entries(strings).filter(([, value]) => value.trim() === '')
		);
		expect(empty).toEqual([]);
	});
});

describe('fill', () => {
	it('substitutes named placeholders', () => {
		expect(fill(STRINGS.en.zoomReset, { n: '2.5' })).toBe('Zoom 2.5×, tap to reset');
		expect(fill(STRINGS.hu.zoomReset, { n: 3 })).toBe('Nagyítás 3×, koppintson a visszaállításhoz');
	});

	it('leaves unknown placeholders alone', () => {
		expect(fill('a {b} c', {})).toBe('a {b} c');
	});
});
