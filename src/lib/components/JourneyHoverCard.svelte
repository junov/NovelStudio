<script lang="ts">
	/**
	 * Rich contextual hover card for Journey Rail steps, pills, and play buttons.
	 * @spec JRN-001, JRN-002, JRN-003
	 */
	import type { PipelineStage } from '$lib/stages';
	import type { StatusJson } from '$lib/types';
	import {
		getStageStepInfo,
		getStagePillInfo,
		getStageActionInfo,
		getStageAcceptInfo
	} from '$lib/stagesHover';

	interface Props {
		type: 'step' | 'pill' | 'play' | 'accept';
		stage: PipelineStage;
		stageIndex: number;
		stageState: { status: 'needs-sync' | 'synced' | 'pending'; badge: string };
		status: StatusJson | null;
		targetRect: DOMRect;
		railRect: DOMRect;
		unstagedFiles?: Set<string>;
	}

	let { type, stage, stageIndex, stageState, status, targetRect, railRect, unstagedFiles }: Props = $props();

	let stepInfo = $derived(getStageStepInfo(stage, stageIndex, status));
	let pillInfo = $derived(getStagePillInfo(stage, status, stageState.badge, stageState.status));
	let actionInfo = $derived(getStageActionInfo(stage, status));
	let acceptInfo = $derived(getStageAcceptInfo(stage, unstagedFiles));

	// Position relative to parent rail container
	let positionStyle = $derived.by(() => {
		const CARD_WIDTH = 300;
		const targetCenter = targetRect.left - railRect.left + targetRect.width / 2;
		const minLeft = 12;
		const maxLeft = Math.max(minLeft, railRect.width - CARD_WIDTH - 16);
		const calculatedLeft = Math.max(minLeft, Math.min(maxLeft, targetCenter - CARD_WIDTH / 2));
		const top = targetRect.bottom - railRect.top + 8;

		return `left: ${Math.round(calculatedLeft)}px; top: ${Math.round(top)}px; width: ${CARD_WIDTH}px;`;
	});
</script>

<div class="journey-hover-card {type}" style={positionStyle}>
	{#if type === 'step'}
		<div class="card-header">
			<span class="step-tag">{stepInfo.sequenceLabel}</span>
			<span class="skill-tag">{stepInfo.skill}</span>
		</div>
		<h4 class="card-title">{stepInfo.title}</h4>
		<p class="card-desc">{stepInfo.description}</p>
		<p class="card-methodology">{stepInfo.methodology}</p>
		{#if stepInfo.paths.length > 0}
			<div class="card-footer">
				<span class="footer-label">Primary Paths:</span>
				<div class="path-chips">
					{#each stepInfo.paths as p}
						<code class="path-chip">{p}</code>
					{/each}
				</div>
			</div>
		{/if}
	{:else if type === 'pill'}
		<div class="card-header">
			<span class="pill-tag {pillInfo.status}">{pillInfo.badge || 'Status'}</span>
			<span class="stage-tag">{stage.label}</span>
		</div>
		<h4 class="card-title">{pillInfo.title}</h4>

		{#if pillInfo.actionHint}
			<div class="action-hint">
				<span class="hint-icon">⚡</span>
				<span class="hint-text">{pillInfo.actionHint}</span>
			</div>
		{/if}

		<p class="card-desc">{pillInfo.description}</p>

		{#if pillInfo.items && pillInfo.items.length > 0}
			<div class="card-items-block">
				<span class="footer-label">Affected Items:</span>
				<ul class="items-list">
					{#each pillInfo.items.slice(0, 5) as item}
						<li><code class="item-code">{item}</code></li>
					{/each}
					{#if pillInfo.items.length > 5}
						<li class="more-items">+ {pillInfo.items.length - 5} more</li>
					{/if}
				</ul>
			</div>
		{/if}

		{#if pillInfo.lastAcceptedDate}
			<div class="accepted-info">
				<span class="footer-label">Last Accepted:</span>
				<span class="accepted-date">{pillInfo.lastAcceptedDate}</span>
			</div>
		{/if}
	{:else if type === 'play'}
		<div class="card-header">
			<span class="action-tag" class:inactive={!actionInfo.isActionable}>
				{actionInfo.isActionable ? 'Actionable' : 'No Action Required'}
			</span>
			<span class="stage-tag">{stage.label}</span>
		</div>
		<h4 class="card-title">{actionInfo.title}</h4>

		{#if actionInfo.isActionable}
			<p class="card-desc">{actionInfo.description}</p>
			{#if actionInfo.items && actionInfo.items.length > 0}
				<div class="card-items-block">
					<span class="footer-label">Target Scope:</span>
					<div class="path-chips">
						{#each actionInfo.items.slice(0, 4) as item}
							<code class="path-chip">{item}</code>
						{/each}
						{#if actionInfo.items.length > 4}
							<span class="more-chips">+{actionInfo.items.length - 4} more</span>
						{/if}
					</div>
				</div>
			{/if}
		{:else}
			<div class="disabled-notice">
				<p class="disabled-reason">{actionInfo.disabledReason || 'Nothing to do at this stage.'}</p>
			</div>
		{/if}
	{:else if type === 'accept'}
		<div class="card-header">
			<span class="pill-tag accept">✓ Accept</span>
			<span class="stage-tag">{stage.label}</span>
		</div>
		<h4 class="card-title">{acceptInfo.title}</h4>
		<p class="card-desc">{acceptInfo.description}</p>

		{#if acceptInfo.files.length > 0}
			<div class="card-items-block">
				<span class="footer-label">Uncommitted Changes ({acceptInfo.files.length}):</span>
				<ul class="items-list">
					{#each acceptInfo.files.slice(0, 6) as file}
						<li><code class="item-code">{file}</code></li>
					{/each}
					{#if acceptInfo.files.length > 6}
						<li class="more-items">+ {acceptInfo.files.length - 6} more</li>
					{/if}
				</ul>
			</div>
		{/if}
	{/if}
</div>

<style>
	.journey-hover-card {
		position: absolute;
		z-index: 1000;
		background: var(--paper);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08);
		padding: 12px 14px;
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
		font-size: 11px;
		gap: 6px;
	}

	.step-tag,
	.stage-tag {
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--ink-soft);
	}

	.skill-tag {
		font-family: var(--font-mono, monospace);
		font-size: 10.5px;
		background: var(--bg-sunken);
		padding: 1px 6px;
		border-radius: 4px;
		color: var(--ink-soft);
	}

	.pill-tag {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		padding: 1px 6px;
		border-radius: 999px;
	}
	.pill-tag.synced {
		background: color-mix(in srgb, var(--ok) 18%, transparent);
		color: var(--ok);
	}
	.pill-tag.needs-sync {
		background: color-mix(in srgb, var(--warn) 18%, transparent);
		color: var(--warn);
	}
	.pill-tag.pending {
		background: var(--bg-sunken);
		color: var(--ink-soft);
	}
	.pill-tag.accept {
		background: color-mix(in srgb, var(--ok) 20%, transparent);
		color: var(--ok);
		border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent);
	}

	.action-tag {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 1px 6px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--ok) 15%, transparent);
		color: var(--ok);
	}
	.action-tag.inactive {
		background: var(--bg-sunken);
		color: var(--ink-soft);
	}

	.card-title {
		margin: 0;
		font-size: 14px;
		font-family: var(--font-title, serif);
		color: var(--ink);
		font-weight: 700;
		line-height: 1.25;
	}

	.card-desc {
		margin: 0;
		font-size: 12px;
		line-height: 1.45;
		color: var(--ink);
	}

	.card-methodology {
		margin: 0;
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--ink-soft);
		font-style: italic;
	}

	.card-footer,
	.card-items-block,
	.accepted-info {
		margin-top: 4px;
		padding-top: 6px;
		border-top: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.footer-label {
		font-size: 10.5px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--ink-soft);
		letter-spacing: 0.04em;
	}

	.path-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.path-chip,
	.item-code {
		font-family: var(--font-mono, monospace);
		font-size: 10.5px;
		padding: 2px 6px;
		background: var(--bg-sunken);
		border-radius: 3px;
		color: var(--ink);
		word-break: break-all;
	}

	.items-list {
		margin: 0;
		padding-left: 14px;
		font-size: 11.5px;
		color: var(--ink);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.more-items,
	.more-chips {
		font-size: 10.5px;
		color: var(--ink-soft);
		font-style: italic;
	}

	.accepted-info {
		flex-direction: row;
		align-items: center;
		gap: 8px;
	}
	.accepted-date {
		font-size: 11px;
		color: var(--ink-soft);
	}

	.disabled-notice {
		background: var(--bg-sunken);
		padding: 6px 8px;
		border-radius: 4px;
		border-left: 3px solid var(--ink-soft);
	}
	.disabled-reason {
		margin: 0;
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--ink-soft);
	}

	.action-hint {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		padding: 4px 8px;
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
		border-radius: 4px;
		font-size: 11px;
		color: var(--accent);
		font-weight: 500;
	}
	.hint-icon {
		font-size: 12px;
	}
</style>
