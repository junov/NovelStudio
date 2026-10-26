<script lang="ts">
	/**
	 * Pipeline Journey Rail
	 * @spec AGT-008, AGT-009, JRN-001, JRN-002 (Issue #7, #8)
	 */
	import { project } from '$lib/stores/project.svelte';
	import { PIPELINE, resolveStageExecution, type PipelineStage } from '$lib/stages';
	import { agent } from '$lib/agent/engine.svelte';
	import { getStageActionInfo } from '$lib/stagesHover';
	import JourneyHoverCard from './JourneyHoverCard.svelte';

	let railContainer = $state<HTMLDivElement | null>(null);

	let activeHover = $state<{
		type: 'step' | 'pill' | 'play';
		stage: PipelineStage;
		stageIndex: number;
		stageState: { status: 'needs-sync' | 'synced' | 'pending'; badge: string };
		targetRect: DOMRect;
		railRect: DOMRect;
	} | null>(null);

	function showHover(
		type: 'step' | 'pill' | 'play',
		stage: PipelineStage,
		stageIndex: number,
		stageState: { status: 'needs-sync' | 'synced' | 'pending'; badge: string },
		el: HTMLElement
	) {
		if (!railContainer) return;
		activeHover = {
			type,
			stage,
			stageIndex,
			stageState,
			targetRect: el.getBoundingClientRect(),
			railRect: railContainer.getBoundingClientRect()
		};
	}

	function hideHover() {
		activeHover = null;
	}

	function getStageState(stage: PipelineStage): { status: 'needs-sync' | 'synced' | 'pending'; badge: string } {
		const status = project.status;
		if (!status) return { status: 'pending', badge: '' };

		const syncName = stage.sync;
		const baseline = syncName ? status.baselines?.[syncName] : null;
		const localDrift = syncName && status.drift?.[syncName] ? status.drift[syncName].length : 0;
		const upstreamDrift =
			syncName && status.upstream_drift?.[syncName] ? status.upstream_drift[syncName].length : 0;
		const totalDrift = localDrift + upstreamDrift;

		let pendingCount = 0;
		if (stage.id === 'abridged') pendingCount = status.pending?.abridged ?? 0;
		if (stage.id === 'manuscript') pendingCount = status.pending?.manuscript ?? 0;
		if (stage.id === 'publishable') {
			pendingCount = status.illustrations?.pending ?? status.graphics?.pending ?? 0;
		}
		if (stage.id === 'world') {
			pendingCount = status.pending_items?.['research']?.length ?? status.catalog?.['RQ'] ?? 0;
		}

		if (totalDrift > 0 || pendingCount > 0) {
			return {
				status: 'needs-sync',
				badge: totalDrift > 0 ? `${totalDrift} drift` : `${pendingCount} pending`
			};
		}

		if (baseline || status.generatedStages?.[stage.id]) {
			return { status: 'synced', badge: 'synced' };
		}

		// Stage hasn't been generated/accepted yet
		return { status: 'pending', badge: '' };
	}

	function runStageSkill(stage: PipelineStage) {
		const action = getStageActionInfo(stage, project.status);
		if (!action.isActionable) return;
		const resolved = resolveStageExecution(stage, project.status);
		agent.run(resolved.skill, resolved.prompt, stage.id);
	}
</script>

<div class="journey-rail" bind:this={railContainer}>
	<div class="stages-track">
		{#each PIPELINE as stage, i}
			{@const st = getStageState(stage)}
			{@const action = getStageActionInfo(stage, project.status)}
			<div
				class="stage-node {st.status}"
				onclick={() => {
					// Open main file for this stage
					if (stage.paths.length > 0) {
						project.openFile(stage.paths[0]);
					}
				}}
			>
				<div
					class="node-badge-row"
					onmouseenter={(e) => showHover('step', stage, i, st, e.currentTarget)}
					onmouseleave={hideHover}
				>
					<span class="node-step">{i + 1}</span>
					<span class="node-label">{stage.label}</span>
				</div>

				<div class="node-meta">
					{#if st.badge}
						<span
							class="pill {st.status}"
							onmouseenter={(e) => {
								e.stopPropagation();
								showHover('pill', stage, i, st, e.currentTarget);
							}}
							onmouseleave={hideHover}
						>
							{st.badge}
						</span>
					{/if}
				</div>

				<button
					class="run-skill-btn"
					class:disabled={!action.isActionable}
					disabled={!action.isActionable || agent.status === 'running'}
					onclick={(e) => {
						e.stopPropagation();
						runStageSkill(stage);
					}}
					onmouseenter={(e) => {
						e.stopPropagation();
						showHover('play', stage, i, st, e.currentTarget);
					}}
					onmouseleave={hideHover}
				>
					▶
				</button>
			</div>

			{#if i < PIPELINE.length - 1}
				<div class="stage-connector"></div>
			{/if}
		{/each}
	</div>

	{#if activeHover && railContainer}
		<JourneyHoverCard
			type={activeHover.type}
			stage={activeHover.stage}
			stageIndex={activeHover.stageIndex}
			stageState={activeHover.stageState}
			status={project.status}
			targetRect={activeHover.targetRect}
			railRect={activeHover.railRect}
		/>
	{/if}
</div>

<style>
	.journey-rail {
		position: relative;
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
		transition: all 0.15s ease;
	}
	.run-skill-btn:hover:not(.disabled) {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.run-skill-btn.disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.run-skill-btn.disabled:hover {
		background: var(--bg-sunken);
		color: var(--ink-soft);
	}

	.stage-connector {
		flex: 1;
		height: 2px;
		background: var(--line);
		min-width: 8px;
	}
</style>
