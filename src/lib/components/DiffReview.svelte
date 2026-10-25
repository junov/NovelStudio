<script lang="ts">
	import type { ApprovalRequest } from '$lib/agent/types';
	import { settings } from '$lib/stores/settings.svelte';
	import * as Diff from 'diff';

	interface Props {
		request: ApprovalRequest;
	}

	let { request }: Props = $props();

	let autoApproveThisRun = $state(false);

	const diffChunks = $derived(() => {
		if (request.kind === 'write_file' && request.originalContent !== undefined && request.newContent !== undefined) {
			return Diff.diffLines(request.originalContent, request.newContent);
		}
		return null;
	});

	function handleApprove() {
		if (autoApproveThisRun) {
			settings.update({ autoApprove: true });
		}
		request.resolve(true);
	}

	function handleReject() {
		request.resolve(false);
	}
</script>

<div class="diff-review-card card">
	<div class="diff-header">
		<span class="diff-icon">⚖</span>
		<div class="diff-title-box">
			<span class="diff-kind">{request.kind.toUpperCase()}</span>
			<h4 class="diff-title">{request.title}</h4>
		</div>
	</div>

	<div class="diff-body">
		{#if request.command}
			<div class="cmd-preview">
				<code>{request.command}</code>
			</div>
		{/if}

		{#if diffChunks()}
			<div class="diff-viewer">
				{#each diffChunks()! as part}
					<pre
						class="diff-line"
						class:added={part.added}
						class:removed={part.removed}
					><code>{part.value}</code></pre>
				{/each}
			</div>
		{/if}
	</div>

	<div class="diff-footer">
		<label class="auto-approve-toggle">
			<input type="checkbox" bind:checked={autoApproveThisRun} />
			<span>Auto-approve future edits in this run</span>
		</label>

		<div class="footer-buttons">
			<button class="btn small danger ghost" onclick={handleReject}>
				Reject
			</button>
			<button class="btn small primary" onclick={handleApprove}>
				Approve Change
			</button>
		</div>
	</div>
</div>

<style>
	.diff-review-card {
		margin: 12px 0;
		border: 1px solid var(--accent);
		background: var(--paper);
		overflow: hidden;
		flex-shrink: 0;
		min-height: fit-content;
	}

	.diff-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: var(--bg-sunken);
		border-bottom: 1px solid var(--line);
	}
	.diff-icon {
		font-size: 16px;
	}
	.diff-title-box {
		display: flex;
		flex-direction: column;
	}
	.diff-kind {
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--accent);
	}
	.diff-title {
		margin: 0;
		font-size: 13px;
		font-family: var(--font-mono);
	}

	.diff-body {
		max-height: 280px;
		overflow-y: auto;
		background: var(--paper);
	}

	.cmd-preview {
		padding: 10px 14px;
		background: var(--bg-sunken);
		font-family: var(--font-mono);
		font-size: 12px;
	}

	.diff-viewer {
		font-family: var(--font-mono);
		font-size: 11.5px;
		line-height: 1.45;
	}
	.diff-line {
		margin: 0;
		padding: 1px 12px;
		white-space: pre-wrap;
		word-break: break-all;
	}
	.diff-line.added {
		background: color-mix(in srgb, var(--ok) 18%, transparent);
		color: var(--ok);
	}
	.diff-line.removed {
		background: color-mix(in srgb, var(--err) 18%, transparent);
		color: var(--err);
		text-decoration: line-through;
	}

	.diff-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 14px;
		background: var(--bg-elev);
		border-top: 1px solid var(--line);
		gap: 12px;
	}

	.auto-approve-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11.5px;
		color: var(--ink-soft);
		cursor: pointer;
	}

	.footer-buttons {
		display: flex;
		gap: 8px;
	}
</style>
