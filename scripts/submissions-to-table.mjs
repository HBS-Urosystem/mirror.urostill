#!/usr/bin/env node
/**
 * Turns Netlify's CSV export of the `mirror-test` form into one table for
 * comparing phones: a row per submission, a column per value in its `data`
 * field. Nested values get dotted names — answers.batteryBefore_pct,
 * camera.settledWidth, start.changes.2.pauseS — with lists numbered from 1.
 *
 *   npm run submissions -- ~/Downloads/mirror-test.csv > runs.csv
 *
 * Netlify's own columns, such as the date, are kept in front. `summary` is
 * left out: it is the same run written for reading, and too long for a cell.
 * The `version` column says which version of the test each run came from.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * RFC 4180: commas, double quotes and line breaks inside quoted fields.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
	/** @type {string[][]} */
	const rows = [];
	/** @type {string[]} */
	let row = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c !== '"') field += c;
			else if (text[i + 1] === '"') {
				field += '"';
				i++;
			} else quoted = false;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

/** @param {string} value */
const cell = (value) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

/** @param {unknown[][]} rows */
export const toCsv = (rows) =>
	rows.map((row) => row.map((v) => cell(String(v))).join(',')).join('\n') + '\n';

/**
 * Nested values as dotted names. A list of plain values becomes one cell; a
 * list of objects is numbered from 1, the way the readable report numbers them.
 * @param {unknown} value
 * @param {string} [prefix]
 * @param {Record<string, string>} [out]
 * @returns {Record<string, string>}
 */
export function flatten(value, prefix = '', out = {}) {
	if (value === null || value === undefined) {
		if (prefix) out[prefix] = '';
	} else if (Array.isArray(value)) {
		if (value.every((v) => v === null || typeof v !== 'object')) out[prefix] = value.join('; ');
		else value.forEach((v, i) => flatten(v, `${prefix}.${i + 1}`, out));
	} else if (typeof value === 'object') {
		for (const [key, v] of Object.entries(value))
			flatten(v, prefix ? `${prefix}.${key}` : key, out);
	} else {
		out[prefix] = String(value);
	}
	return out;
}

/** Columns of the export that are not carried over. */
const LEFT_OUT = new Set(['data', 'summary', 'form-name']);

/**
 * @param {string} csvText the export, as Netlify writes it
 * @returns {string} the table, as CSV
 */
export function convert(csvText) {
	const rows = parseCsv(csvText.replace(/^﻿/, '')).filter((r) => r.some((c) => c.trim()));
	const [header, ...submissions] = rows;
	if (!header) throw new Error('The file is empty.');
	const dataAt = header.findIndex((h) => h.trim().toLowerCase() === 'data');
	if (dataAt === -1) {
		throw new Error('There is no "data" column. Is this the export of the mirror-test form?');
	}
	const kept = header
		.map((name, at) => ({ name: name.trim(), at }))
		.filter(({ name }) => !LEFT_OUT.has(name.toLowerCase()));

	/** @type {Record<string, string>[]} */
	const records = submissions.map((row) => {
		const own = Object.fromEntries(kept.map(({ name, at }) => [name, row[at] ?? '']));
		const raw = (row[dataAt] ?? '').trim();
		if (!raw) return own;
		try {
			return { ...own, ...flatten(JSON.parse(raw)) };
		} catch {
			return { ...own, data: 'not valid JSON' };
		}
	});

	// Every column any submission has, in the order they were first seen.
	const columns = [...new Set(records.flatMap((r) => Object.keys(r)))];
	return toCsv([columns, ...records.map((r) => columns.map((c) => r[c] ?? ''))]);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
	const path = process.argv[2];
	if (!path) {
		console.error('Usage: npm run submissions -- <the CSV exported from Netlify> > runs.csv');
		process.exit(1);
	}
	try {
		process.stdout.write(convert(readFileSync(path, 'utf8')));
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
