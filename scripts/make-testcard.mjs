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

/**
 * `--scale 1.163` compensates for an output path that cannot be set to 100 %:
 * a printer that insists on fitting to the page, or a screen whose CSS
 * millimetre is not a millimetre. Measure the ruler, divide 50 by what you
 * got, pass that, and measure again. The default writes the true-size card.
 */
const args = process.argv.slice(2);
const flag = (name) => {
	const at = args.indexOf(name);
	return at === -1 ? undefined : args[at + 1];
};
const SCALE = Number(flag('--scale') ?? 1);
if (!Number.isFinite(SCALE) || SCALE <= 0) {
	console.error('--scale must be a positive number');
	process.exit(1);
}
const OUT_NAME = flag('--out') ?? (SCALE === 1 ? 'testcard.svg' : 'testcard-scaled.svg');

const W = 210;
const H = 297;
const MARGIN = 15;

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
	// The page grows with the scale while the viewBox does not, so everything is
	// drawn larger and nothing is clipped off the edge.
	`<svg xmlns="http://www.w3.org/2000/svg" width="${(W * SCALE).toFixed(3)}mm" height="${(H * SCALE).toFixed(3)}mm" viewBox="0 0 ${W} ${H}">`,
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

// Text lines, from small to large: the guided test asks whether the text is
// sharp at some distance, and the small lines are where a soft picture shows.
add(text(MARGIN, 60, 2.8, 'Text', 'font-weight="700"'));

let y = 71;
for (const cap of CAP_HEIGHTS) {
	add(text(MARGIN, y, 2, `${cap.toFixed(2)} mm`));
	add(text(MARGIN + 22, y, cap, SPECIMEN));
	y += cap + 7;
}

add(text(MARGIN, y + 8, 2, 'Keep the card flat and evenly lit.'));

add(`</g>`, `</svg>`, '');

const out = fileURLToPath(new URL(`../docs/${OUT_NAME}`, import.meta.url));
writeFileSync(out, parts.join('\n'));
console.log(
	`wrote docs/${OUT_NAME} at ${SCALE}× (${CAP_HEIGHTS.length} text lines)`
);
if (SCALE !== 1) console.log('Check the ruler against a real one before using it.');
