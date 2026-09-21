/**
 * Every tunable in the app. Nothing outside this file hard-codes a limit,
 * a width, a timeout or a threshold.
 */

/** Zoom is a multiplier on the cover-fitted picture. */
export const ZOOM_MIN = 1;
/**
 * Above ~2–2.5× at 1080p, a normally sighted viewer already sees every camera
 * pixel: more zoom enlarges but doesn't sharpen. Kept at 5× because
 * enlargement itself helps people with reduced vision. Revisit after phase 5.
 */
export const ZOOM_MAX = 5;
/** Start wide, so the user can aim the phone before magnifying. */
export const ZOOM_START = 1;

/** Resolution upgrade (PLAN §2, Camera). */
export const RES_MAX_LONG_SIDE = 3840;
/** Below this measured frame rate the upgrade is given back. */
export const RES_FPS_FLOOR = 24;
/** How long to count frames after upgrading. */
export const RES_PROBE_MS = 2000;
/** Phase 5b: apply native zoom this long after a gesture ends. */
export const NATIVE_ZOOM_SETTLE_MS = 200;

/** Halo width as a fraction of the short side of the screen. */
export const HALO_LEVELS = { off: 0, soft: 0.08, bright: 0.16 } as const;
export type HaloLevel = keyof typeof HALO_LEVELS;
export const HALO_ORDER: readonly HaloLevel[] = ['off', 'soft', 'bright'];
export const HALO_DEFAULT: HaloLevel = 'bright';

/** The one choreographed motion in the app: the halo opening on start. */
export const HALO_OPEN_MS = 400;

/** The control pill hides itself after this long without interaction. */
export const PILL_AUTOHIDE_MS = 3000;
export const PILL_FADE_MS = 150;

/** Gesture recognition. */
export const TAP_SLOP_PX = 8;
export const TAP_MAX_MS = 250;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_SLOP_PX = 30;

/**
 * Camera constraints. All `ideal`, never `exact`: a desktop webcam in dev and
 * a phone that cannot do 1080p should both still produce a picture.
 */
export const CAMERA_IDEAL = { width: 1920, height: 1080, frameRate: 30 } as const;
