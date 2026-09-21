#!/usr/bin/env node
/**
 * Enforces the hard rules in CLAUDE.md by scanning src/.
 *
 *   1. No capture      — nothing that can produce a photo, a video or a file.
 *   2. No persistence  — nothing that survives a reload.
 *   3. No outbound network — the app's own origin only.
 *   4. Pixels may only be read inside src/lib/motion/ (the scoped exception).
 *
 * Deliberately a dumb text scan with no escape hatch: a match in a comment is
 * still a failure, so the rules cannot be talked around in passing.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ rule: number; pattern: RegExp; why: string; allowIn?: string }} Check
 * @typedef {{ file: string; line: number; text: string; match: string; rule: number; why: string }} Finding
 */

/** @type {Check[]} */
export const CHECKS = [
	{ rule: 1, pattern: /\bMediaRecorder\b/, why: 'no video recording' },
	{ rule: 1, pattern: /\btakePhoto\b/, why: 'no photo capture' },
	{ rule: 1, pattern: /\bgrabFrame\b/, why: 'no frame capture' },
	{ rule: 1, pattern: /\btoDataURL\b/, why: 'no image export' },
	{ rule: 1, pattern: /\btoBlob\b/, why: 'no image export' },
	{ rule: 1, pattern: /\bdownload\s*=/, why: 'no downloads' },
	{ rule: 1, pattern: /<a\b[^>]*\bdownload\b/, why: 'no downloads' },
	{ rule: 2, pattern: /\blocalStorage\b/, why: 'no persistence' },
	{ rule: 2, pattern: /\bsessionStorage\b/, why: 'no persistence' },
	{ rule: 2, pattern: /\bindexedDB\b/i, why: 'no persistence' },
	{ rule: 2, pattern: /document\s*\.\s*cookie/, why: 'no cookies' },
	{ rule: 3, pattern: /\bsendBeacon\b/, why: 'no telemetry' },
	{ rule: 3, pattern: /\bXMLHttpRequest\b/, why: 'no outbound network' },
	{ rule: 3, pattern: /\bWebSocket\b/, why: 'no outbound network' },
	{ rule: 3, pattern: /\bEventSource\b/, why: 'no outbound network' },
	{ rule: 3, pattern: /\bfetch\s*\(\s*['"`]https?:\/\//, why: 'no outbound network' },
	{ rule: 3, pattern: /\bimport\s*\(\s*['"`]https?:\/\//, why: 'no remote modules' },
	{ rule: 3, pattern: /@import\s+(?:url\()?\s*['"]?https?:\/\//, why: 'no remote stylesheets' },
	{
		rule: 4,
		pattern: /\bgetImageData\b/,
		why: 'pixels may only be read inside src/lib/motion/',
		allowIn: 'lib/motion/'
	}
];

const SCANNED = new Set(['.ts', '.js', '.mjs', '.svelte', '.css', '.html', '.json']);

/**
 * @param {string} file posix-style path relative to src/
 * @param {string} text
 * @returns {Finding[]}
 */
export function scanText(file, text) {
	/** @type {Finding[]} */
	const findings = [];
	const lines = text.split('\n');
	for (const check of CHECKS) {
		if (check.allowIn && file.startsWith(check.allowIn)) continue;
		lines.forEach((line, i) => {
			const m = check.pattern.exec(line);
			if (m) {
				findings.push({
					file,
					line: i + 1,
					text: line.trim(),
					match: m[0],
					rule: check.rule,
					why: check.why
				});
			}
		});
	}
	return findings.sort((a, b) => a.line - b.line);
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
	/** @type {string[]} */
	const out = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) out.push(...walk(path));
		else if (SCANNED.has(entry.slice(entry.lastIndexOf('.')))) out.push(path);
	}
	return out;
}

/** @param {string} srcDir @returns {Finding[]} */
export function scanDir(srcDir) {
	return walk(srcDir).flatMap((path) =>
		scanText(relative(srcDir, path).split(sep).join('/'), readFileSync(path, 'utf8'))
	);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
	const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
	const findings = scanDir(srcDir);
	for (const f of findings) {
		console.error(`src/${f.file}:${f.line}  ${f.match}  — rule ${f.rule}: ${f.why}\n    ${f.text}`);
	}
	if (findings.length > 0) {
		console.error(`\ncheck:privacy failed with ${findings.length} finding(s).`);
		process.exit(1);
	}
	console.log(`check:privacy passed (${CHECKS.length} rules).`);
}
