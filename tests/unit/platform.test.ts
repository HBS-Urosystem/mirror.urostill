import { describe, expect, it } from 'vitest';
import { isIos, isStandalone } from '../../src/lib/platform';

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const MAC =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const ANDROID =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

describe('isIos', () => {
	it('recognises an iPhone', () => {
		expect(isIos(IPHONE, 5)).toBe(true);
	});

	it('recognises an iPad, which claims to be a Mac', () => {
		expect(isIos(IPAD_AS_MAC, 5)).toBe(true);
	});

	it('is not fooled by a real Mac with a trackpad', () => {
		expect(isIos(MAC, 0)).toBe(false);
		expect(isIos(IPAD_AS_MAC, 0)).toBe(false);
	});

	it('leaves Android alone, since Chrome offers its own install', () => {
		expect(isIos(ANDROID, 5)).toBe(false);
	});
});

describe('isStandalone', () => {
	it('accepts either signal', () => {
		expect(isStandalone(true, undefined)).toBe(true);
		expect(isStandalone(false, true)).toBe(true);
	});

	it('is false in a browser tab', () => {
		expect(isStandalone(false, false)).toBe(false);
		expect(isStandalone(false, undefined)).toBe(false);
	});
});
