<script lang="ts">
	import { project } from '$lib/stores/project.svelte';
	import { settings, PROVIDERS, type ProviderId } from '$lib/stores/settings.svelte';
	import { agent } from '$lib/agent/engine.svelte';
	import { pickFolder } from '$lib/tauri';
	import { formatModelLabel } from '$lib/agent/providers';

	interface Props {
		onNewProject: () => void;
		onOpenProject: () => void;
		onOpenSettings: () => void;
		onOpenPalette: () => void;
	}

	let { onNewProject, onOpenProject, onOpenSettings, onOpenPalette }: Props = $props();

	async function selectFolder() {
		const selected = await pickFolder();
		if (selected) {
			await project.open(selected);
			settings.addRecent(selected, project.title);
		}
	}
</script>

<header class="app-header">
	<div class="header-left">
		<button class="nav-btn" disabled={!project.canBack} onclick={() => project.back()} title="Back">
			←
		</button>
		<button class="nav-btn" disabled={!project.canForward} onclick={() => project.forward()} title="Forward">
			→
		</button>

		<div class="brand">
			<span class="logo-mark">❦</span>
			<span class="logo-text">NovelStudio</span>
		</div>

		{#if project.root}
			<div class="project-pill" onclick={selectFolder} title={project.root}>
				<span class="project-name">{project.title}</span>
				<span class="project-change">▾</span>
			</div>
			<!-- @spec PROJ-003 -->
			<button
				class="new-project-btn"
				onclick={onNewProject}
				title="Create New Novel Project"
				aria-label="Create New Novel Project"
			>
				+
			</button>
		{/if}
	</div>

	<div class="header-center">
		<button class="palette-trigger" onclick={onOpenPalette} title="Command Palette (Ctrl+K)">
			<span class="search-icon">🔍</span>
			<span class="search-label">Jump to entity, file, or command...</span>
			<kbd>Ctrl+K</kbd>
		</button>
	</div>

	<div class="header-right">
		{#if project.root}
			<div class="quick-views">
				<button
					class="btn small ghost"
					class:active={project.view.kind === 'dashboard'}
					onclick={() => project.navigate({ kind: 'dashboard' })}
				>
					Overview
				</button>
				<button
					class="btn small ghost"
					class:active={project.view.kind === 'analysis'}
					onclick={() => project.navigate({ kind: 'analysis' })}
				>
					Analysis
				</button>
				<button
					class="btn small ghost"
					class:active={project.view.kind === 'book'}
					onclick={() => project.navigate({ kind: 'book' })}
				>
					Book Preview
				</button>
			</div>
		{/if}

		{#if agent.status !== 'idle'}
			<div class="agent-badge {agent.status}">
				<span class="pulse"></span>
				<span>Agent: {agent.status}</span>
			</div>
		{/if}

		<div class="model-indicator" onclick={onOpenSettings} title="Active Model — Click to configure or query models">
			<span class="provider-dot {settings.value.defaultModel.provider}"></span>
			<span class="model-name">{formatModelLabel(settings.value.defaultModel.model)}</span>
			{#if settings.value.defaultModel.thinkingLevel && settings.value.defaultModel.thinkingLevel !== 'off'}
				<span class="thinking-pill" title="Thinking: {settings.value.defaultModel.thinkingLevel}">🧠 {settings.value.defaultModel.thinkingLevel}</span>
			{/if}
		</div>

		<button class="icon-btn" onclick={onOpenSettings} title="Settings & Keys">
			⚙
		</button>

		{#if !project.root}
			<button class="btn small primary" onclick={onNewProject}>
				+ New Novel
			</button>
		{/if}
	</div>
</header>

<style>
	.app-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 48px;
		padding: 0 16px;
		background: var(--paper);
		border-bottom: 1px solid var(--line);
		user-select: none;
		gap: 16px;
	}

	.header-left,
	.header-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.nav-btn {
		background: none;
		border: none;
		font-size: 16px;
		color: var(--ink-soft);
		padding: 2px 6px;
		border-radius: 4px;
	}
	.nav-btn:hover:not(:disabled) {
		background: var(--bg-sunken);
		color: var(--ink);
	}
	.nav-btn:disabled {
		opacity: 0.3;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		font-family: var(--font-prose);
		font-size: 16px;
		color: var(--accent);
	}
	.logo-mark {
		font-size: 18px;
	}

	.project-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		background: var(--bg-sunken);
		border-radius: var(--radius);
		font-size: 12.5px;
		font-weight: 500;
		cursor: pointer;
		max-width: 220px;
	}
	.project-pill:hover {
		filter: brightness(0.97);
	}
	.project-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.project-change {
		font-size: 10px;
		color: var(--ink-faint);
	}

	.new-project-btn {
		width: 24px;
		height: 24px;
		border-radius: var(--radius);
		border: 1px solid var(--line);
		background: var(--bg-sunken);
		color: var(--ink-soft);
		font-size: 15px;
		font-weight: 600;
		line-height: 1;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 0;
	}
	.new-project-btn:hover {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: var(--accent);
	}

	.palette-trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px;
		background: var(--bg-sunken);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		color: var(--ink-faint);
		font-size: 12.5px;
		width: 320px;
		text-align: left;
	}
	.palette-trigger:hover {
		border-color: var(--line-strong);
		color: var(--ink-soft);
	}
	.palette-trigger kbd {
		margin-left: auto;
		background: var(--paper);
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		padding: 1px 5px;
		font-size: 10px;
		font-family: var(--font-mono);
	}

	.quick-views {
		display: flex;
		gap: 2px;
		background: var(--bg-sunken);
		padding: 2px;
		border-radius: var(--radius);
	}
	.quick-views .btn.active {
		background: var(--paper);
		color: var(--ink);
		font-weight: 600;
	}

	.model-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--ink-soft);
		padding: 4px 8px;
		border-radius: var(--radius);
		background: var(--bg-sunken);
	}
	.provider-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.provider-dot.anthropic {
		background: #d97706;
	}
	.provider-dot.openai {
		background: #10b981;
	}
	.provider-dot.gemini {
		background: #3b82f6;
	}

	.thinking-pill {
		font-size: 10px;
		font-weight: 600;
		text-transform: capitalize;
		padding: 1px 5px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--accent);
	}

	.agent-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
	}
	.agent-badge.running {
		background: #dbeafe;
		color: #1e40af;
	}
	.agent-badge.awaiting_user_input {
		background: #fef3c7;
		color: #92400e;
	}
	.agent-badge.awaiting_approval {
		background: #fee2e2;
		color: #991b1b;
	}
	.pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
		animation: pulse-anim 1.2s infinite;
	}
	@keyframes pulse-anim {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}
</style>
