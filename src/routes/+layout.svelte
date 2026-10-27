<script lang="ts">
	import '../app.css';
	import WikiHoverCard from '$lib/components/WikiHoverCard.svelte';
	import { setupWikiHoverListeners } from '$lib/wikiHover.svelte';

	let { children } = $props();

	$effect(() => {
		const cleanup = setupWikiHoverListeners();
		return cleanup;
	});
</script>

{@render children()}
<WikiHoverCard />
