import { describe, expect, it } from 'vitest';
import {
	capResolution,
	errorName,
	isWorthUpgrading,
	mapCameraError
} from '../../src/lib/camera.svelte';

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

describe('capResolution', () => {
	it('leaves a resolution that already fits alone', () => {
		expect(capResolution(1920, 1080, 3840)).toEqual({ width: 1920, height: 1080 });
		expect(capResolution(3840, 2160, 3840)).toEqual({ width: 3840, height: 2160 });
	});

	it('shrinks to the cap, keeping the aspect ratio', () => {
		expect(capResolution(4032, 3024, 3840)).toEqual({ width: 3840, height: 2880 });
		expect(capResolution(8000, 6000, 3840)).toEqual({ width: 3840, height: 2880 });
	});

	it('caps the long side whichever way round the sensor is', () => {
		expect(capResolution(3024, 4032, 3840)).toEqual({ width: 2880, height: 3840 });
	});

	it('does not divide by zero on a camera that reports nothing', () => {
		expect(capResolution(0, 0, 3840)).toEqual({ width: 0, height: 0 });
	});
});

describe('isWorthUpgrading', () => {
	it('is false when there are no capabilities to read', () => {
		expect(isWorthUpgrading(undefined)).toBe(false);
		expect(isWorthUpgrading({})).toBe(false);
	});

	it('is false when the camera cannot beat 1080p', () => {
		expect(isWorthUpgrading({ width: { max: 1920 }, height: { max: 1080 } })).toBe(false);
		expect(isWorthUpgrading({ width: { max: 1280 }, height: { max: 720 } })).toBe(false);
	});

	it('is true when there are more pixels to be had', () => {
		expect(isWorthUpgrading({ width: { max: 4032 }, height: { max: 3024 } })).toBe(true);
		// A 4:3 mode with fewer pixels on the long side can still be a gain.
		expect(isWorthUpgrading({ width: { max: 2560 }, height: { max: 1920 } })).toBe(true);
	});
});
