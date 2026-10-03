#!/usr/bin/env node
/**
 * docs/testcard.svg → static/testcard.pdf, the card the guided test links to.
 *
 *   npm run testcard
 *
 * Rendered by the Chromium that the end-to-end tests already install. The page
 * is sized by CSS to 210 × 297 mm and the card is not scaled, so the 50 mm
 * ruler stays 50 mm. Chromium rounds the page to whole pixels, which leaves it
 * within 0.12 mm of A4: close enough for any printer to treat it as A4.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../docs/testcard.svg', import.meta.url));
const target = fileURLToPath(new URL('../static/testcard.pdf', import.meta.url));
// The XML declaration is for a standalone file; inside HTML it is just text.
const svg = readFileSync(source, 'utf8').replace(/^<\?xml[^>]*>\s*/, '');

const html = `<!doctype html>
<meta charset="utf-8">
<title>Mirror — test card</title>
<style>
	@page { size: 210mm 297mm; margin: 0 }
	html, body { margin: 0; padding: 0 }
	svg { display: block }
</style>
${svg}`;

const browser = await chromium.launch();
try {
	const page = await browser.newPage();
	await page.setContent(html);
	const pdf = await page.pdf({
		preferCSSPageSize: true,
		printBackground: true,
		margin: { top: '0', right: '0', bottom: '0', left: '0' }
	});
	writeFileSync(target, pdf);
	console.log(`wrote static/testcard.pdf (${Math.round(pdf.length / 1024)} KB)`);
} finally {
	await browser.close();
}
