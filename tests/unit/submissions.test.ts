import { describe, expect, it } from 'vitest';
import { convert, flatten, parseCsv, toCsv } from '../../scripts/submissions-to-table.mjs';

/** A cell the way a CSV export writes it. */
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

describe('parseCsv', () => {
	it('keeps commas, quotes and line breaks that are inside quotes', () => {
		expect(parseCsv('a,"b, c","say ""hi""","one\ntwo"\n')).toEqual([
			['a', 'b, c', 'say "hi"', 'one\ntwo']
		]);
	});

	it('reads Windows line endings', () => {
		expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
	});

	it('round-trips through toCsv', () => {
		const rows = [['x', 'y, z', 'q"q', 'l1\nl2']];
		expect(parseCsv(toCsv(rows))).toEqual(rows);
	});
});

describe('flatten', () => {
	it('gives nested values dotted names, and numbers lists of objects from 1', () => {
		expect(
			flatten({
				version: 1,
				answers: { barsBest_mm: 0.3, sharp30: true, textBest_mm: null },
				start: { changes: [{ atS: 0.1 }, { atS: 2.1 }] }
			})
		).toEqual({
			version: '1',
			'answers.barsBest_mm': '0.3',
			'answers.sharp30': 'true',
			'answers.textBest_mm': '',
			'start.changes.1.atS': '0.1',
			'start.changes.2.atS': '2.1'
		});
	});

	it('puts a list of plain values in one cell', () => {
		expect(flatten({ skipped: ['card-base', 'other'] })).toEqual({ skipped: 'card-base; other' });
	});
});

describe('convert', () => {
	const run = {
		version: 1,
		skipped: ['card-base'],
		answers: { phone: 'iPhone 14 Pro, iOS 26', barsBest_mm: 0.3 },
		start: { changes: [{ atS: 0.1, pauseS: 0.15 }] }
	};
	const exported = [
		'created_at,phone,summary,data',
		`2026-10-03T10:00:00Z,iPhone,${quote('Which phone is this?\n  iPhone')},${quote(JSON.stringify(run))}`
	].join('\n');

	it('makes one row per submission and one column per value, the export’s own columns first', () => {
		const [header, first] = parseCsv(convert(exported));
		expect(header).toEqual([
			'created_at',
			'phone',
			'version',
			'skipped',
			'answers.phone',
			'answers.barsBest_mm',
			'start.changes.1.atS',
			'start.changes.1.pauseS'
		]);
		expect(first).toEqual([
			'2026-10-03T10:00:00Z',
			'iPhone',
			'1',
			'card-base',
			'iPhone 14 Pro, iOS 26',
			'0.3',
			'0.1',
			'0.15'
		]);
	});

	it('leaves the readable summary out of the table', () => {
		expect(convert(exported)).not.toContain('Which phone is this?');
	});

	it('copes with the byte-order mark spreadsheet programs put in front', () => {
		expect(parseCsv(convert('﻿' + exported))[0][0]).toBe('created_at');
	});

	it('says what is wrong with a file that is not this form’s export', () => {
		expect(() => convert('name,email\nA,a@example.com\n')).toThrow('no "data" column');
		expect(() => convert('')).toThrow('empty');
	});

	it('marks a damaged data cell instead of stopping', () => {
		const table = parseCsv(convert('phone,data\nX,{not json\n'));
		expect(table[1]).toEqual(['X', 'not valid JSON']);
	});
});
