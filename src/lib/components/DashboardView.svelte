<script lang="ts">
	import { project } from '$lib/stores/project.svelte';
	import { agent } from '$lib/agent/engine.svelte';
	import { PIPELINE } from '$lib/stages';

	let synopsisText = $state('');

	$effect(() => {
		if (project.root) {
			project.read('story/synopsis.md').then((t) => {
				synopsisText = t.replace(/^#\s+[^\n]+\n+/, ''); // strip title
			}).catch(() => {
				synopsisText = '';
			});
		}
	});

	function runStage(stageId: string) {
		const stage = PIPELINE.find((s) => s.id === stageId);
		if (stage) agent.run(stage.skill, stage.prompt, stage.id);
	}
</script>

<div class="dashboard-view">
	<div class="dashboard-hero">
		<h1 class="hero-title">{project.title}</h1>
		{#if synopsisText}
			<p class="hero-synopsis">{synopsisText.slice(0, 360)}...</p>
		{/if}
	</div>

	<!-- Core Metrics Grid -->
	<div class="metrics-grid">
		<div class="metric-card card">
			<span class="metric-num">{project.status?.scenes.outline || 0}</span>
			<span class="metric-label">Scenes Outlined</span>
			<button class="card-btn" onclick={() => project.openFile('outline/outline.md')}>View Outline →</button>
		</div>

		<div class="metric-card card">
			<span class="metric-num">{(project.status?.words.abridged || 0).toLocaleString()}</span>
			<span class="metric-label">Abridged Draft Words</span>
			<button class="card-btn" onclick={() => runStage('abridged')}>Abridged Sync →</button>
		</div>

		<div class="metric-card card">
			<span class="metric-num">{(project.status?.words.manuscript || 0).toLocaleString()}</span>
			<span class="metric-label">Manuscript Words</span>
			<button class="card-btn" onclick={() => runStage('manuscript')}>Write Prose →</button>
		</div>

		<div class="metric-card card">
			<span class="metric-num">
				{Object.values(project.status?.catalog || {}).reduce((a, b) => a + b, 0)}
			</span>
			<span class="metric-label">Story Bible Entities</span>
			<button class="card-btn" onclick={() => project.openFile('kb/INDEX.md')}>Catalog Index →</button>
		</div>
	</div>

	<!-- Quick Launch Workflows -->
	<div class="workflow-card card">
		<h3 class="workflow-title">Pipeline Quick Actions</h3>
		<div class="actions-grid">
			<div class="action-box" onclick={() => runStage('brief')}>
				<span class="action-icon">✦</span>
				<h4>Discovery Interview</h4>
				<p>Refine genre, scope, cast, theme, and writing style guide.</p>
			</div>
			<div class="action-box" onclick={() => runStage('research')}>
				<span class="action-icon">📚</span>
				<h4>Authoritative Research</h4>
				<p>Resolve open research questions with cited facts.</p>
			</div>
			<div class="action-box" onclick={() => runStage('outline')}>
				<span class="action-icon">🎬</span>
				<h4>Outline & Story DAG</h4>
				<p>Structure parts, chapters, scenes, and causal prerequisites.</p>
			</div>
			<div class="action-box" onclick={() => runStage('manuscript')}>
				<span class="action-icon">🖋</span>
				<h4>Render Prose</h4>
				<p>Generate literary prose guided by style.md and story bible.</p>
			</div>
		</div>
	</div>

	<!-- System Integrity & Errors -->
	{#if project.status && (project.status.errors.length > 0 || project.status.warnings.length > 0)}
		<div class="integrity-card card">
			<h3>Project Integrity & Check Diagnostics</h3>
			{#each project.status.errors as err}
				<div class="diag-item err">
					<span class="diag-tag">ERROR</span>
					<span>{err}</span>
				</div>
			{/each}
			{#each project.status.warnings as warn}
				<div class="diag-item warn">
					<span class="diag-tag">WARN</span>
					<span>{warn}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dashboard-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
		overflow-y: auto;
		padding: 32px 40px;
		gap: 24px;
	}

	.dashboard-hero {
		border-bottom: 1px solid var(--line);
		padding-bottom: 20px;
	}
	.hero-title {
		margin: 0 0 10px;
		font-size: 32px;
		color: var(--ink);
	}
	.hero-synopsis {
		font-family: var(--font-prose);
		font-size: 16px;
		line-height: 1.6;
		color: var(--ink-soft);
		margin: 0;
		max-width: 52em;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}
	.metric-card {
		padding: 20px;
		display: flex;
		flex-direction: column;
	}
	.metric-num {
		font-size: 32px;
		font-family: var(--font-prose);
		font-weight: 700;
		color: var(--accent);
		line-height: 1;
	}
	.metric-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-faint);
		margin: 6px 0 14px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.card-btn {
		margin-top: auto;
		background: none;
		border: none;
		padding: 0;
		font-size: 12px;
		color: var(--accent);
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}
	.card-btn:hover {
		text-decoration: underline;
	}

	.workflow-card {
		padding: 24px;
	}
	.workflow-title {
		margin: 0 0 16px;
		font-size: 16px;
	}
	.actions-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}
	.action-box {
		padding: 16px;
		background: var(--bg-sunken);
		border-radius: var(--radius);
		border: 1px solid var(--line);
		cursor: pointer;
		transition: all 0.15s;
	}
	.action-box:hover {
		border-color: var(--accent);
		background: var(--paper);
		box-shadow: var(--shadow);
	}
	.action-icon {
		font-size: 20px;
		color: var(--accent);
	}
	.action-box h4 {
		margin: 8px 0 4px;
		font-size: 14px;
	}
	.action-box p {
		margin: 0;
		font-size: 11.5px;
		color: var(--ink-faint);
		line-height: 1.4;
	}

	.integrity-card {
		padding: 20px;
	}
	.integrity-card h3 {
		margin-top: 0;
		margin-bottom: 12px;
	}
	.diag-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12.5px;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
	}
	.diag-item:last-child {
		border-bottom: none;
	}
	.diag-tag {
		font-size: 10px;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 4px;
	}
	.diag-item.err .diag-tag {
		background: var(--err);
		color: #fff;
	}
	.diag-item.warn .diag-tag {
		background: var(--warn);
		color: #fff;
	}
</style>
