<script lang="ts">
	/**
	 * Agent activity feed and interactive task panel.
	 * @spec AGT-002, AGT-003
	 */
	import { agent } from '$lib/agent/engine.svelte';
	import InterviewCard from './InterviewCard.svelte';
	import DiffReview from './DiffReview.svelte';

	let customPrompt = $state('');

	function handleSend() {
		if (!customPrompt.trim()) return;
		const text = customPrompt.trim();
		customPrompt = '';
		agent.run(agent.currentSkill || 'novel-sync', text);
	}
</script>

<aside class="agent-panel">
	<div class="panel-header">
		<div class="header-status">
			<span class="status-indicator {agent.status}"></span>
			<span class="panel-title">
				{#if agent.status === 'running'}
					Running {agent.currentSkill}...
				{:else if agent.status === 'awaiting_user_input'}
					Awaiting Author Input
				{:else if agent.status === 'awaiting_approval'}
					Awaiting Approval
				{:else}
					Agent Activity Feed
				{/if}
			</span>
		</div>

		<div class="header-controls">
			{#if agent.status === 'running' || agent.status === 'awaiting_user_input' || agent.status === 'awaiting_approval'}
				<button class="btn small danger ghost" onclick={() => agent.cancel()}>
					Cancel
				</button>
			{:else if agent.feed.length > 0}
				<button class="btn small ghost" onclick={() => agent.clearFeed()}>
					Clear
				</button>
			{/if}
		</div>
	</div>

	<div class="panel-feed">
		{#if agent.activeQuestion}
			<InterviewCard request={agent.activeQuestion} />
		{/if}

		{#if agent.activeApproval}
			<DiffReview request={agent.activeApproval} />
		{/if}

		{#if agent.feed.length === 0 && !agent.activeQuestion && !agent.activeApproval}
			<div class="empty-feed">
				<span class="empty-icon">❦</span>
				<p>Agent is idle. Choose a step from the Journey Rail or type an instruction below to begin.</p>
			</div>
		{/if}

		{#each agent.feed as item}
			<div class="feed-entry {item.type} {item.status || ''}">
				<div class="entry-meta">
					<span class="entry-badge">{item.type}</span>
					<span class="entry-title">{item.title}</span>
					<span class="entry-time">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
				</div>
				{#if item.content}
					<pre class="entry-content"><code>{item.content}</code></pre>
				{/if}
			</div>
		{/each}
	</div>

	<div class="panel-footer">
		{#if agent.totalPromptTokens > 0}
			<div class="token-meter">
				<span>Tokens: {agent.totalPromptTokens.toLocaleString()} in / {agent.totalCompletionTokens.toLocaleString()} out</span>
			</div>
		{/if}

		<form class="prompt-bar" onsubmit={(e) => { e.preventDefault(); handleSend(); }}>
			<input
				type="text"
				placeholder="Message the agent or give instructions..."
				bind:value={customPrompt}
				disabled={agent.status === 'running'}
			/>
			<button class="btn small primary" type="submit" disabled={!customPrompt.trim() || agent.status === 'running'}>
				Send
			</button>
		</form>
	</div>
</aside>

<style>
	.agent-panel {
		width: 360px;
		background: var(--bg-elev);
		border-left: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-bottom: 1px solid var(--line);
		background: var(--paper);
		user-select: none;
	}
	.header-status {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ink-faint);
	}
	.status-indicator.running {
		background: var(--info);
	}
	.status-indicator.awaiting_user_input {
		background: var(--warn);
	}
	.status-indicator.awaiting_approval {
		background: var(--err);
	}

	.panel-title {
		font-weight: 600;
		font-size: 13px;
	}

	.panel-feed {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		user-select: text;
	}

	.empty-feed {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		color: var(--ink-faint);
		height: 100%;
		padding: 20px;
		user-select: none;
	}
	.empty-icon {
		font-size: 32px;
		margin-bottom: 8px;
		color: var(--line-strong);
	}

	.feed-entry {
		padding: 8px 10px;
		border-radius: var(--radius);
		background: var(--paper);
		border: 1px solid var(--line);
		font-size: 12px;
		user-select: text;
	}
	.feed-entry.error {
		border-color: var(--err);
		background: color-mix(in srgb, var(--err) 8%, var(--paper));
	}
	.feed-entry.question {
		border-color: var(--accent);
	}
	.entry-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}
	.entry-badge {
		font-size: 9px;
		text-transform: uppercase;
		font-weight: 700;
		padding: 1px 4px;
		border-radius: 3px;
		background: var(--bg-sunken);
		color: var(--ink-faint);
		user-select: none;
	}
	.entry-title {
		font-weight: 600;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		user-select: text;
	}
	.entry-time {
		font-size: 10px;
		color: var(--ink-faint);
		user-select: none;
	}

	.entry-content {
		margin: 4px 0 0;
		padding: 6px;
		border-radius: 4px;
		background: var(--bg-sunken);
		font-family: var(--font-mono);
		font-size: 11px;
		max-height: 140px;
		overflow-y: auto;
		white-space: pre-wrap;
		user-select: text;
	}
	.entry-content code {
		user-select: text;
	}

	.panel-footer {
		border-top: 1px solid var(--line);
		background: var(--paper);
		padding: 10px 12px;
		user-select: none;
	}
	.token-meter {
		font-size: 11px;
		color: var(--ink-faint);
		margin-bottom: 6px;
	}
	.prompt-bar {
		display: flex;
		gap: 6px;
	}
	.prompt-bar input {
		flex: 1;
		font-size: 12px;
		padding: 6px 10px;
	}
</style>
