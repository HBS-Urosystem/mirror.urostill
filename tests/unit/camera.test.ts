import { describe, expect, it } from 'vitest';
import { errorName, mapCameraError } from '../../src/lib/camera.svelte';

describe('mapCameraError', () => {
	it.each([
		['NotAllowedError', 'errDenied'],
		['SecurityError', 'errDenied'],
		['NotFoundError', 'errNoCamera'],
		['OverconstrainedError', 'errNoCamera'],
		['NotReadableError', 'errInUse'],
		['AbortError', 'errInUse'],
		['TypeError', 'errUnsupported'],
		['SomethingNew', 'errUnsupported']
	])('maps %s to %s', (name, key) => {
		expect(mapCameraError(Object.assign(new Error('x'), { name }))).toBe(key);
	});

	it('handles throwables that are not Errors', () => {
		// OverconstrainedError is its own interface, not an Error subclass.
		expect(mapCameraError({ name: 'OverconstrainedError' })).toBe('errNoCamera');
		expect(mapCameraError('boom')).toBe('errUnsupported');
		expect(mapCameraError(null)).toBe('errUnsupported');
	});
});

describe('errorName', () => {
	it('reads the name where there is one', () => {
		expect(errorName({ name: 'NotReadableError' })).toBe('NotReadableError');
		expect(errorName(undefined)).toBe('');
	});
});
