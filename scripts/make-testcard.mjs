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

/** Everything on the card is centred on the page. */
const CENTRE = W / 2;
const centred = 'text-anchor="middle"';

// Heading
add(text(CENTRE, 20, 4, 'Mirror — test card', `font-weight="700" ${centred}`));
add(
	text(
		CENTRE,
		27,
		2.2,
		'Print at 100 % (no “fit to page”). Check the ruler with a real one before using the card.',
		centred
	)
);

// A 10 cm square in the middle of the page, holding the ruler and the text.
// The guided test asks for the picture to be zoomed until the square is as
// wide as the screen, so every phone is judged at the same framing, and the
// magnification that took is recorded.
const SQUARE = 100;
const squareX = (W - SQUARE) / 2;
const squareY = (H - SQUARE) / 2;
add(
	`<rect x="${squareX}" y="${squareY}" width="${SQUARE}" height="${SQUARE}" fill="none" stroke="#000000" stroke-width="0.5"/>`
);

// Ruler, centred, with what it should measure above it.
const rulerX = CENTRE - 25;
const rulerY = squareY + 19;
add(text(CENTRE, rulerY - 7, 2.2, '50 mm', centred));
add(`<g stroke="#000000" stroke-width="0.25">`);
add(`<line x1="${rulerX}" y1="${rulerY}" x2="${rulerX + 50}" y2="${rulerY}"/>`);
for (let mm = 0; mm <= 50; mm++) {
	const height = mm % 10 === 0 ? 5 : mm % 5 === 0 ? 3 : 1.6;
	add(`<line x1="${rulerX + mm}" y1="${rulerY}" x2="${rulerX + mm}" y2="${rulerY - height}"/>`);
}
add(`</g>`);
for (let mm = 0; mm <= 50; mm += 10) {
	add(text(rulerX + mm, rulerY + 4, 2, `${mm}`, centred));
}

// Text lines, from small to large, each centred: the small lines are where a
// soft picture shows first. Their sizes stay in a column on the left, which is
// where the tester reads off the answer.
let y = rulerY + 15;
for (const cap of CAP_HEIGHTS) {
	add(text(squareX + 8, y, 2, `${cap.toFixed(2)} mm`));
	add(text(CENTRE, y, cap, SPECIMEN, centred));
	y += cap + 7;
}

add(text(CENTRE, squareY + SQUARE + 12, 2, 'Keep the card flat and evenly lit.', centred));

add(`</g>`, `</svg>`, '');

const out = fileURLToPath(new URL('../docs/testcard.svg', import.meta.url));
writeFileSync(out, parts.join('\n'));
console.log(`wrote docs/testcard.svg (${CAP_HEIGHTS.length} text lines)`);
