<script lang="ts">
	/**
	 * Rich contextual hovercard previewing a wiki-link destination.
	 * Shows the first 5 lines completely, with the 6th line fading vertically to transparent.
	 * @spec BBL-006
	 */
	import { wikiHover } from '$lib/wikiHover.svelte';

	let preview = $derived(wikiHover.preview);
	let targetRect = $derived(wikiHover.targetRect);

	let style = $derived.by(() => {
		if (!targetRect || typeof window === 'undefined') return 'display: none;';
		const CARD_WIDTH = 340;
		const targetCenter = targetRect.left + targetRect.width / 2;
		const minLeft = 12;
		const maxLeft = Math.max(minLeft, window.innerWidth - CARD_WIDTH - 16);
		const calculatedLeft = Math.max(minLeft, Math.min(maxLeft, targetCenter - CARD_WIDTH / 2));

		// Position above or below depending on available space
		const spaceBelow = window.innerHeight - targetRect.bottom;
		const ESTIMATED_HEIGHT = 175;
		let top = targetRect.bottom + 6;
		if (spaceBelow < ESTIMATED_HEIGHT && targetRect.top > ESTIMATED_HEIGHT) {
			top = targetRect.top - ESTIMATED_HEIGHT - 6;
		}

		return `left: ${Math.round(calculatedLeft)}px; top: ${Math.round(top)}px; width: ${CARD_WIDTH}px;`;
	});
</script>

{#if wikiHover.active && targetRect}
	<div class="wiki-hover-card" {style}>
		{#if wikiHover.loading && !preview}
			<div class="card-loading">Loading destination preview...</div>
		{:else if preview}
			<div class="card-header">
				<span class="wiki-tag" style="--hue: {preview.hue}">
					{preview.icon} {preview.id}
				</span>
				<span class="file-path">{preview.path}</span>
			</div>
			{#if preview.title && preview.title !== preview.id}
				<h4 class="card-title">{preview.title}</h4>
			{/if}
			<div class="wiki-preview-content">
				{@html preview.renderedHtml}
			</div>
		{/if}
	</div>
{/if}

<style>
	.wiki-hover-card {
		position: fixed;
		z-index: 9999;
		background: var(--paper);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22), 0 2px 6px rgba(0, 0, 0, 0.1);
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-family: var(--font-ui, sans-serif);
		pointer-events: none;
		animation: hover-fade-in 0.12s ease-out;
	}

	@keyframes hover-fade-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.wiki-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 7px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
		background: hsl(var(--hue) 80% 90% / 0.7);
		color: hsl(var(--hue) 60% 25%);
		border: 1px solid hsl(var(--hue) 60% 75% / 0.5);
	}

	:global([data-theme='dark']) .wiki-tag {
		background: hsl(var(--hue) 45% 25% / 0.6);
		color: hsl(var(--hue) 70% 80%);
		border-color: hsl(var(--hue) 40% 40% / 0.5);
	}

	.file-path {
		font-size: 11px;
		font-family: var(--font-mono, monospace);
		color: var(--ink-faint);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-title {
		margin: 0;
		font-size: 13.5px;
		font-family: var(--font-title, serif);
		color: var(--ink);
		font-weight: 700;
		line-height: 1.25;
	}

	/* Preview body: 5 complete lines (0-100px), 6th line fades vertically to transparent (100-120px) */
	.wiki-preview-content {
		position: relative;
		font-size: 13px;
		line-height: 20px;
		max-height: 120px;
		overflow: hidden;
		-webkit-mask-image: linear-gradient(to bottom, black 100px, transparent 120px);
		mask-image: linear-gradient(to bottom, black 100px, transparent 120px);
	}

	.wiki-preview-content :global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	.wiki-preview-content :global(h1),
	.wiki-preview-content :global(h2),
	.wiki-preview-content :global(h3),
	.wiki-preview-content :global(h4) {
		font-size: 13.5px;
		font-weight: 700;
		line-height: 20px;
		color: var(--ink);
	}

	.wiki-preview-content :global(p),
	.wiki-preview-content :global(li) {
		font-size: 13px;
		line-height: 20px;
		color: var(--ink-soft);
	}

	.wiki-preview-content :global(p + p),
	.wiki-preview-content :global(p + ul),
	.wiki-preview-content :global(ul + p) {
		margin-top: 2px;
	}

	.wiki-preview-content :global(ul),
	.wiki-preview-content :global(ol) {
		padding-left: 18px;
	}

	.wiki-preview-content :global(strong) {
		font-weight: 600;
		color: var(--ink);
	}

	.wiki-preview-content :global(code) {
		font-family: var(--font-mono);
		font-size: 11.5px;
		background: var(--bg-sunken);
		padding: 1px 4px;
		border-radius: 3px;
	}

	.wiki-preview-content :global(.wiki-chip) {
		pointer-events: none;
	}

	.card-loading {
		font-size: 12px;
		color: var(--ink-faint);
		font-style: italic;
		padding: 4px 0;
	}
</style>
