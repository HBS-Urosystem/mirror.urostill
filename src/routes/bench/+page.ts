// A development instrument rather than part of the product, but it is
// prerendered with everything else so it can be opened on a phone from a
// deploy preview — which is the only way some phones will ever reach it.
// The service worker leaves it out of the offline cache.
export const prerender = true;
export const ssr = false;
