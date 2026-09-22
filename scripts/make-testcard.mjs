#!/usr/bin/env node
/**
 * Generates docs/testcard.svg: an A4 card for the phase 5 device tests.
 *
 * Printed at 100 % scale, one SVG user unit is one millimetre, so every
 * measurement on the card is accurate — the ruler is there to prove it.
 *
 *   node scripts/make-testcard.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const W = 210;
const H = 297;
const MARGIN = 15;

/** Bar widths in mm. A group is three bars with gaps of the same width. */
const BAR_WIDTHS = [0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1.0];
const BAR_LENGTH = 12;
const CELL = 21;

/** Cap heights in mm. Arial's cap height is about 0.716 of its font size. */
const CAP_HEIGHTS = [1, 1.25, 1.5, 2, 2.5, 3, 4];
const CAP_RATIO = 0.716;
/** Confusable letters and digits, all uppercase so the cap height is the height. */
const SPECIMEN = 'DKNRSVZ 0369';

const FONT = 'Arial, Helvetica, sans-serif';
const parts = [];
const add = (...lines) => parts.push(...lines);

const text = (x, y, capMm, content, extra = '') =>
	`<text x="${x}" y="${y}" font-family="${FONT}" font-size="${(capMm / CAP_RATIO).toFixed(3)}" ${extra}>${content}</text>`;

add(
	`<?xml version="1.0" encoding="UTF-8"?>`,
	`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`,
	`<rect width="${W}" height="${H}" fill="#ffffff"/>`,
	`<g fill="#000000">`
);

// Heading
add(text(MARGIN, 20, 4, 'Mirror — test card', 'font-weight="700"'));
add(
	text(
		MARGIN,
		27,
		2.2,
		'Print at 100 % (no “fit to page”). Check the ruler with a real one before using the card.'
	)
);

// Ruler
const rulerY = 44;
add(`<g stroke="#000000" stroke-width="0.25">`);
add(`<line x1="${MARGIN}" y1="${rulerY}" x2="${MARGIN + 50}" y2="${rulerY}"/>`);
for (let mm = 0; mm <= 50; mm++) {
	const height = mm % 10 === 0 ? 5 : mm % 5 === 0 ? 3 : 1.6;
	add(`<line x1="${MARGIN + mm}" y1="${rulerY}" x2="${MARGIN + mm}" y2="${rulerY - height}"/>`);
}
add(`</g>`);
for (let mm = 0; mm <= 50; mm += 10) {
	add(text(MARGIN + mm, rulerY + 4, 2, `${mm}`, 'text-anchor="middle"'));
}
add(text(MARGIN + 56, rulerY + 1, 2.2, '50 mm'));

/** Three bars and two gaps, all of width `w`. */
function barGroup(cx, cy, w, vertical) {
	const span = 5 * w;
	const out = [];
	for (let i = 0; i < 3; i++) {
		const offset = -span / 2 + i * 2 * w;
		out.push(
			vertical
				? `<rect x="${(cx + offset).toFixed(3)}" y="${cy - BAR_LENGTH / 2}" width="${w}" height="${BAR_LENGTH}"/>`
				: `<rect x="${cx - BAR_LENGTH / 2}" y="${(cy + offset).toFixed(3)}" width="${BAR_LENGTH}" height="${w}"/>`
		);
	}
	return out;
}

// Resolution chart
add(text(MARGIN, 60, 2.8, 'Resolution chart', 'font-weight="700"'));
add(
	text(MARGIN, 65, 2, 'Report the finest group where three separate bars are still visible, in mm.')
);

const chartLeft = (W - BAR_WIDTHS.length * CELL) / 2 + CELL / 2;
const rows = [
	{ y: 80, vertical: true, label: 'vertical bars — horizontal detail' },
	{ y: 112, vertical: false, label: 'horizontal bars — vertical detail' }
];
for (const row of rows) {
	add(text(MARGIN, row.y - 10, 2, row.label));
	BAR_WIDTHS.forEach((w, i) => {
		const cx = chartLeft + i * CELL;
		add(...barGroup(cx, row.y, w, row.vertical));
		add(text(cx, row.y + 11, 2, w.toFixed(2), 'text-anchor="middle"'));
	});
}

// Text lines
add(text(MARGIN, 140, 2.8, 'Text', 'font-weight="700"'));
add(
	text(
		MARGIN,
		145,
		2,
		'Report the smallest line that can be read without guessing, by its cap height in mm.'
	)
);

let y = 156;
for (const cap of CAP_HEIGHTS) {
	add(text(MARGIN, y, 2, `${cap.toFixed(2)} mm`));
	add(text(MARGIN + 22, y, cap, SPECIMEN));
	y += cap + 7;
}

add(
	text(
		MARGIN,
		y + 8,
		2,
		'Keep the card flat and evenly lit. Measure the distance to the camera, not to the screen.'
	)
);

add(`</g>`, `</svg>`, '');

const out = fileURLToPath(new URL('../docs/testcard.svg', import.meta.url));
writeFileSync(out, parts.join('\n'));
console.log(
	`wrote docs/testcard.svg (${BAR_WIDTHS.length} bar groups, ${CAP_HEIGHTS.length} text lines)`
);
