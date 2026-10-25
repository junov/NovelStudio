<script lang="ts">
	/**
	 * Grouped Work Card for consecutive tool and thought execution entries.
	 * Collapsed by default with in-progress animation when busy.
	 * @spec AGT-006, BBL-003 (Issue #4)
	 */
	import type { FeedItem } from '$lib/agent/types';
	import { wikiLinks } from '$lib/actions';
	import { renderWikiChips } from '$lib/markdown';

	interface Props {
		items: FeedItem[];
		isBusy: boolean;
		currentSkill?: string | null;
	}

	let { items = [], isBusy = false, currentSkill = null }: Props = $props();

	// Collapsed by default to keep the feed clean
	let isExpanded = $state(false);

	let latestTitle = $derived.by(() => {
		if (items.length > 0) {
			return items[items.length - 1].title;
		}
		if (currentSkill) {
			return `Running ${currentSkill}...`;
		}
		return 'Working...';
	});

	let summaryTitle = $derived.by(() => {
		if (isBusy) {
			return latestTitle;
		}
		if (items.length === 0) {
			return 'Work completed';
		}
		if (items.length === 1) {
			return `1 work item completed: ${items[0].title}`;
		}
		return `${items.length} work items completed`;
	});
</script>

<div class="work-card" class:busy={isBusy} class:expanded={isExpanded} use:wikiLinks>
	<div
		class="work-header"
		onclick={() => (isExpanded = !isExpanded)}
		role="button"
		tabindex="0"
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				isExpanded = !isExpanded;
			}
		}}
	>
		<div class="work-status-box">
			{#if isBusy}
				<span class="work-spinner" title="Work in progress"></span>
			{:else}
				<span class="work-icon settled" title="Completed">✓</span>
			{/if}
			<span class="work-title" title={summaryTitle}>
				{@html renderWikiChips(summaryTitle)}
			</span>
		</div>

		<div class="work-meta">
			{#if items.length > 0}
				<span class="work-count-badge">
					{items.length} work item{items.length === 1 ? '' : 's'}
				</span>
			{/if}
			<button
				type="button"
				class="work-toggle-btn"
				onclick={(e) => {
					e.stopPropagation();
					isExpanded = !isExpanded;
				}}
				aria-label={isExpanded ? 'Collapse work details' : 'Expand work details'}
			>
				{isExpanded ? '▴' : '▾'}
			</button>
		</div>
	</div>

	{#if isExpanded}
		<div class="work-body">
			{#if items.length === 0}
				<div class="work-empty-detail">
					<span>No work items recorded yet</span>
				</div>
			{:else}
				{#each items as item}
					<div class="work-item {item.type} {item.status || ''}">
						<div class="item-meta">
							<span class="item-badge">{item.type}</span>
							<span class="item-title">{@html renderWikiChips(item.title)}</span>
							<span class="item-time">
								{new Date(item.timestamp).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit',
									second: '2-digit'
								})}
							</span>
						</div>
						{#if item.content}
							<pre class="item-content"><code>{@html renderWikiChips(item.content)}</code></pre>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.work-card {
		background: var(--paper);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		flex-shrink: 0;
		min-height: fit-content;
		user-select: text;
		transition: all 0.15s ease;
		overflow: hidden;
	}

	.work-card.busy {
		border-color: var(--info);
		background: color-mix(in srgb, var(--info) 3%, var(--paper));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--info) 20%, transparent);
	}

	.work-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 7px 10px;
		cursor: pointer;
		user-select: none;
		gap: 8px;
		background: var(--paper);
	}
	.work-card.busy .work-header {
		background: color-mix(in srgb, var(--info) 6%, var(--paper));
	}
	.work-header:hover {
		background: var(--bg-sunken);
	}

	.work-status-box {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
	}

	.work-spinner {
		width: 12px;
		height: 12px;
		border: 2px solid color-mix(in srgb, var(--info) 30%, transparent);
		border-top-color: var(--info);
		border-radius: 50%;
		animation: work-spin 0.8s linear infinite;
		flex-shrink: 0;
	}
	@keyframes work-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.work-icon.settled {
		font-size: 11px;
		color: var(--accent);
		font-weight: 700;
		flex-shrink: 0;
	}

	.work-title {
		font-size: 11.5px;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.work-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.work-count-badge {
		font-size: 9.5px;
		padding: 1px 5px;
		border-radius: 10px;
		background: var(--bg-sunken);
		color: var(--ink-faint);
		font-weight: 600;
	}

	.work-toggle-btn {
		background: none;
		border: none;
		padding: 2px 4px;
		font-size: 11px;
		color: var(--ink-faint);
		cursor: pointer;
		border-radius: 3px;
		line-height: 1;
	}
	.work-toggle-btn:hover {
		color: var(--ink);
		background: var(--bg-sunken);
	}

	.work-body {
		padding: 8px 10px 10px 10px;
		border-top: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: color-mix(in srgb, var(--bg-sunken) 40%, var(--paper));
	}

	.work-empty-detail {
		font-size: 11px;
		color: var(--ink-faint);
		font-style: italic;
		padding: 4px;
	}

	.work-item {
		padding: 6px 8px;
		border-radius: 4px;
		background: var(--paper);
		border: 1px solid var(--line);
		font-size: 11px;
		user-select: text;
	}
	.work-item.error {
		border-color: var(--err);
		background: color-mix(in srgb, var(--err) 8%, var(--paper));
	}

	.item-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 2px;
	}

	.item-badge {
		font-size: 8.5px;
		text-transform: uppercase;
		font-weight: 700;
		padding: 1px 3px;
		border-radius: 2px;
		background: var(--bg-sunken);
		color: var(--ink-faint);
	}

	.item-title {
		font-weight: 600;
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-time {
		font-size: 9.5px;
		color: var(--ink-faint);
	}

	.item-content {
		margin: 4px 0 0;
		padding: 5px;
		border-radius: 3px;
		background: var(--bg-sunken);
		font-family: var(--font-mono);
		font-size: 10.5px;
		max-height: 120px;
		overflow-y: auto;
		white-space: pre-wrap;
	}
</style>
