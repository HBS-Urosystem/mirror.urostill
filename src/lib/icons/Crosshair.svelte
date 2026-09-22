<script lang="ts">
	/**
	 * Marks the part of the picture the mirror will follow. A dark stroke
	 * underneath a white one, so it reads over anything the camera shows, and a
	 * gap in the middle so it never hides the point it marks.
	 */
	const ARMS = 'M14 1v10M14 17v10M1 14h10M17 14h10';
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 28 28"
	width="28"
	height="28"
	fill="none"
	stroke-linecap="round"
	aria-hidden="true"
>
	<path d={ARMS} stroke="rgb(22 33 43 / 0.7)" stroke-width="4" />
	<path d={ARMS} stroke="#ffffff" stroke-width="2" />
</svg>
