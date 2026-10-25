<script lang="ts">
	/**
	 * Pipeline Journey Rail
	 * @spec AGT-008, AGT-009 (Issue #8)
	 */
	import { project } from '$lib/stores/project.svelte';
	import { PIPELINE, type PipelineStage } from '$lib/stages';
	import { agent } from '$lib/agent/engine.svelte';

	function getStageState(stage: PipelineStage) {
		const status = project.status;
		if (!status) return { status: 'idle', label: '' };

		const syncName = stage.sync;
		const baseline = syncName ? status.baselines[syncName] : null;
		const drift = syncName && status.drift[syncName] ? status.drift[syncName].length : 0;

		let pendingCount = 0;
		if (stage.id === 'abridged') pendingCount = status.pending.abridged;
		if (stage.id === 'manuscript') pendingCount = status.pending.manuscript;
		if (stage.id === 'graphics') pendingCount = status.graphics.pending;

		if (drift > 0 || pendingCount > 0) {
			return {
				status: 'needs-sync',
				badge: drift > 0 ? `${drift} drift` : `${pendingCount} pending`
			};
		}

		if (baseline) {
			return { status: 'synced', badge: 'synced' };
		}

		// Stage hasn't been synced yet
		return { status: 'pending', badge: '' };
	}

	function runStageSkill(stage: PipelineStage) {
		agent.run(stage.skill, stage.prompt, stage.id);
	}
</script>

<div class="journey-rail">
	<div class="stages-track">
		{#each PIPELINE as stage, i}
			{@const st = getStageState(stage)}
			<div
				class="stage-node {st.status}"
				onclick={() => {
					// Open main file for this stage
					if (stage.paths.length > 0) {
						project.openFile(stage.paths[0]);
					}
				}}
				title="{stage.label}: {stage.description}"
			>
				<div class="node-badge-row">
					<span class="node-step">{i + 1}</span>
					<span class="node-label">{stage.label}</span>
				</div>

				<div class="node-meta">
					{#if st.badge}
						<span class="pill {st.status}">{st.badge}</span>
					{/if}
				</div>

				<button
					class="run-skill-btn"
					onclick={(e) => {
						e.stopPropagation();
						runStageSkill(stage);
					}}
					title="Run {stage.skill}"
				>
					▶
				</button>
			</div>

			{#if i < PIPELINE.length - 1}
				<div class="stage-connector"></div>
			{/if}
		{/each}
	</div>
</div>

<style>
	.journey-rail {
		background: var(--bg-elev);
		border-bottom: 1px solid var(--line);
		padding: 10px 16px;
	}

	.stages-track {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		overflow-x: auto;
		padding-bottom: 6px;
	}

	.stage-node {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: var(--radius);
		background: var(--paper);
		border: 1px solid var(--line);
		cursor: pointer;
		user-select: none;
		flex-shrink: 0;
		transition: all 0.15s ease;
	}
	.stage-node:hover {
		border-color: var(--line-strong);
		box-shadow: var(--shadow);
	}

	.stage-node.synced {
		border-left: 3px solid var(--ok);
	}
	.stage-node.needs-sync {
		border-left: 3px solid var(--warn);
	}

	.node-badge-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.node-step {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--bg-sunken);
		font-size: 11px;
		display: grid;
		place-items: center;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.node-label {
		font-weight: 600;
		font-size: 12.5px;
	}

	.pill {
		font-size: 10.5px;
		padding: 1px 6px;
		border-radius: 999px;
		font-weight: 500;
	}
	.pill.synced {
		background: color-mix(in srgb, var(--ok) 15%, transparent);
		color: var(--ok);
	}
	.pill.needs-sync {
		background: color-mix(in srgb, var(--warn) 15%, transparent);
		color: var(--warn);
	}

	.run-skill-btn {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: none;
		background: var(--bg-sunken);
		color: var(--ink-soft);
		font-size: 10px;
		display: grid;
		place-items: center;
		cursor: pointer;
		margin-left: 4px;
	}
	.run-skill-btn:hover {
		background: var(--accent);
		color: var(--accent-ink);
	}

	.stage-connector {
		flex: 1;
		height: 2px;
		background: var(--line);
		min-width: 8px;
	}
</style>
