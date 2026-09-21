/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { base, build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

/** One cache per deployment; the old ones go on activate. */
const CACHE = `mirror-${version}`;

/**
 * The app's own build output and nothing else — hard rule 2. `prerendered`
 * carries the shell, which the offline navigation fallback needs.
 */
const ASSETS = [...build, ...files, ...prerendered];
const SHELL = `${base}/`;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	// There is nothing else to talk to, but say so anyway.
	if (url.origin !== sw.location.origin) return;

	event.respondWith(respond(request, url));
});

async function respond(request: Request, url: URL): Promise<Response> {
	const cache = await caches.open(CACHE);

	// Cache first: every file the app needs is already here, and a deployment
	// never changes a URL in place.
	const cached = await cache.match(url.pathname);
	if (cached) return cached;

	// A reload or a deep link while offline. The app is one prerendered shell.
	if (request.mode === 'navigate') {
		const shell = await cache.match(SHELL);
		if (shell) return shell;
	}

	// Anything else goes to the network and is deliberately not stored:
	// the cache holds the build and nothing the user has seen.
	return fetch(request);
}
