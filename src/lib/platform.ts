/**
 * What the browser will and will not do for us. Pure predicates over values
 * the caller reads from the platform, so they can be tested.
 */

/**
 * iOS has no install prompt: the user has to go through the Share menu, so
 * it is the one platform that needs to be told.
 */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
	if (/iPad|iPhone|iPod/.test(userAgent)) return true;
	// iPadOS 13 and later report themselves as a Mac; only touch gives it away.
	return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** Already installed: `display-mode` covers the standard, `navigator.standalone` iOS. */
export function isStandalone(
	displayModeStandalone: boolean,
	navigatorStandalone?: boolean
): boolean {
	return displayModeStandalone || navigatorStandalone === true;
}
