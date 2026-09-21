#!/usr/bin/env node
/**
 * Generates the PWA icons: a white ring on Lagoon, echoing the halo.
 * No letters, no brand, nothing camera-like.
 *
 * Zero dependencies on purpose — this writes the PNGs by hand so the build
 * stays free of image tooling. Run it only when the icon design changes:
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LAGOON = [0x1f, 0x6f, 0x6b];
const WHITE = [0xff, 0xff, 0xff];
const SAMPLES = 4; // supersampling per axis, so the ring edge is smooth

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

/** @param {Buffer} buf */
function crc32(buf) {
	let c = 0xffffffff;
	for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

/** @param {string} type @param {Buffer} data */
function chunk(type, data) {
	const head = Buffer.alloc(4);
	head.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([head, body, crc]);
}

/** @param {number} size @param {Uint8Array} rgba */
function png(size, rgba) {
	const stride = size * 4;
	const raw = Buffer.alloc((stride + 1) * size);
	for (let y = 0; y < size; y++) {
		raw[y * (stride + 1)] = 0; // filter: none
		raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type: RGBA
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/**
 * @param {number} size
 * @param {number} outer ring outer radius, as a fraction of the size
 * @param {number} stroke ring thickness, as a fraction of the size
 */
function ringIcon(size, outer, stroke) {
	const rgba = new Uint8Array(size * size * 4);
	const c = size / 2;
	const rOut = outer * size;
	const rIn = rOut - stroke * size;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let hits = 0;
			for (let sy = 0; sy < SAMPLES; sy++) {
				for (let sx = 0; sx < SAMPLES; sx++) {
					const dx = x + (sx + 0.5) / SAMPLES - c;
					const dy = y + (sy + 0.5) / SAMPLES - c;
					const d = Math.hypot(dx, dy);
					if (d <= rOut && d >= rIn) hits++;
				}
			}
			const t = hits / (SAMPLES * SAMPLES);
			const i = (y * size + x) * 4;
			for (let ch = 0; ch < 3; ch++) {
				rgba[i + ch] = Math.round(LAGOON[ch] + (WHITE[ch] - LAGOON[ch]) * t);
			}
			rgba[i + 3] = 0xff;
		}
	}
	return png(size, rgba);
}

const out = (name) => fileURLToPath(new URL(`../static/icons/${name}`, import.meta.url));

/** @type {[string, number, number, number][]} */
const icons = [
	['icon-192.png', 192, 0.34, 0.085],
	['icon-512.png', 512, 0.34, 0.085],
	// Maskable: the ring stays inside the 80% safe zone.
	['maskable-512.png', 512, 0.3, 0.075],
	['apple-touch-icon-180.png', 180, 0.34, 0.085]
];

for (const [name, size, outer, stroke] of icons) {
	writeFileSync(out(name), ringIcon(size, outer, stroke));
	console.log(`wrote static/icons/${name}`);
}

const r = 0.34 * 64;
const w = 0.085 * 64;
writeFileSync(
	out('favicon.svg'),
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
	<rect width="64" height="64" fill="#1f6f6b" />
	<circle cx="32" cy="32" r="${r - w / 2}" fill="none" stroke="#ffffff" stroke-width="${w}" />
</svg>
`
);
console.log('wrote static/icons/favicon.svg');
