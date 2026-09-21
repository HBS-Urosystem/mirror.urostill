import { expect, test } from '@playwright/test';

declare global {
	interface Window {
		__cspViolations: string[];
	}
}

test('the shell loads with no CSP violation and no cross-origin request', async ({ page }) => {
	await page.addInitScript(() => {
		window.__cspViolations = [];
		document.addEventListener('securitypolicyviolation', (event) => {
			window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
		});
	});

	const consoleErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => consoleErrors.push(error.message));

	const foreign: string[] = [];
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (url.origin !== 'http://localhost:4173' && url.protocol !== 'data:') {
			foreign.push(request.url());
		}
	});

	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mirror');
	expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
	expect(consoleErrors).toEqual([]);
	expect(foreign).toEqual([]);
});
