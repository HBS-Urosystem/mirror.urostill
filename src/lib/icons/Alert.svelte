<script lang="ts">
	let { size = 40, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	class={className}
	aria-hidden="true"
>
	<circle cx="12" cy="12" r="9" />
	<path d="M12 7v6" />
	<path d="M12 16.4v.1" />
</svg>
