<script lang="ts">
	import { onMount } from 'svelte';
	import type { AskUserQuestion, AskUserRequest, UserAnswer } from '$lib/agent/types';
	import { getInterviewPrompt, submitInterviewAnswers, closeWindow } from '$lib/tauri';
	import InterviewCard from './InterviewCard.svelte';

	let activeRequest = $state<AskUserRequest | null>(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			const raw = await getInterviewPrompt();
			if (raw) {
				const parsed = JSON.parse(raw) as { id: string; title: string; questions: AskUserQuestion[] };
				activeRequest = {
					id: parsed.id,
					title: parsed.title,
					questions: parsed.questions,
					resolve: async (answers: UserAnswer[]) => {
						await submitInterviewAnswers(JSON.stringify(answers));
					}
				};
			}
		} catch (e) {
			console.error('Failed to load interview prompt:', e);
		} finally {
			loading = false;
		}
	});

	async function handleClose() {
		await closeWindow('interview');
	}
</script>

<div class="interview-window-layout">
	<div class="window-header">
		<div class="header-title-row">
			<span class="icon">✦</span>
			<h2>{activeRequest?.title || 'Author Interview'}</h2>
		</div>
		<button class="btn small ghost" onclick={handleClose} title="Close window">✕</button>
	</div>

	<div class="window-body">
		{#if loading}
			<div class="loading-state">
				<p class="muted">Loading interview questions...</p>
			</div>
		{:else if activeRequest}
			<InterviewCard request={activeRequest} />
		{:else}
			<div class="empty-state card">
				<span class="empty-icon">❦</span>
				<h3>No Active Interview</h3>
				<p class="muted">There are currently no pending questions from the AI assistant.</p>
				<button class="btn primary small" onclick={handleClose}>Close Window</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.interview-window-layout {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100vh;
		background: var(--bg);
		overflow: hidden;
	}

	.window-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 20px;
		background: var(--paper);
		border-bottom: 1px solid var(--line);
		user-select: none;
	}

	.header-title-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.header-title-row .icon {
		color: var(--accent);
		font-size: 16px;
	}

	.header-title-row h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.window-body {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
		display: flex;
		justify-content: center;
	}

	.window-body :global(.interview-card) {
		width: 100%;
		max-width: 680px;
		height: fit-content;
	}

	.empty-state {
		text-align: center;
		padding: 40px;
		max-width: 440px;
		margin: auto;
	}

	.empty-icon {
		font-size: 36px;
		color: var(--accent);
		display: block;
		margin-bottom: 12px;
	}

	.loading-state {
		display: grid;
		place-items: center;
		width: 100%;
	}
</style>
