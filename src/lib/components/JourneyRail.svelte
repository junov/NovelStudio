<script lang="ts">
	/**
	 * Pipeline Journey Rail
	 * @spec AGT-008, AGT-009, JRN-001, JRN-002, JRN-003, JRN-006 (Issue #7, #8)
	 */
	import { project } from '$lib/stores/project.svelte';
	import { PIPELINE, resolveStageExecution, type PipelineStage } from '$lib/stages';
	import { agent } from '$lib/agent/engine.svelte';
	import {
		getStageActionInfo,
		getStageUnstagedFiles,
		hasStageGeneratedContent
	} from '$lib/stagesHover';
	import JourneyHoverCard from './JourneyHoverCard.svelte';

	let railContainer = $state<HTMLDivElement | null>(null);

	let activeHover = $state<{
		type: 'step' | 'pill' | 'play';
		stage: PipelineStage;
		stageIndex: number;
		stageState: { status: 'needs-sync' | 'synced' | 'pending'; badge: string; canAccept?: boolean };
		targetRect: DOMRect;
		railRect: DOMRect;
	} | null>(null);

	function showHover(
		type: 'step' | 'pill' | 'play',
		stage: PipelineStage,
		stageIndex: number,
		stageState: { status: 'needs-sync' | 'synced' | 'pending'; badge: string; canAccept?: boolean },
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

	function getStageState(stage: PipelineStage): {
		status: 'needs-sync' | 'synced' | 'pending';
		badge: string;
		canAccept: boolean;
	} {
		const status = project.status;
		if (!status) return { status: 'pending', badge: '', canAccept: false };

		const syncName = stage.sync;
		const baseline = syncName ? status.baselines?.[syncName] : null;

		// All stages start in the pending state, until they are generated for the first time (@spec JRN-005)
		const isGenerated =
			Boolean(baseline) ||
			Boolean(status.generatedStages?.[stage.id]) ||
			project.isStageGenerated(stage.id);

		if (!isGenerated) {
			return { status: 'pending', badge: '', canAccept: false };
		}

		const localDrift = syncName && status.drift?.[syncName] ? status.drift[syncName].length : 0;
		const upstreamDrift =
			syncName && status.upstream_drift?.[syncName] ? status.upstream_drift[syncName].length : 0;
		const stageUnstaged = getStageUnstagedFiles(stage, project.unstagedFiles);
		const effectiveDrift = Math.max(localDrift + upstreamDrift, stageUnstaged.length);

		let pendingCount = 0;
		if (stage.id === 'abridged') pendingCount = status.pending?.abridged ?? 0;
		if (stage.id === 'manuscript') pendingCount = status.pending?.manuscript ?? 0;
		if (stage.id === 'publishable') {
			pendingCount = status.illustrations?.pending ?? status.graphics?.pending ?? 0;
		}
		if (stage.id === 'world') {
			pendingCount = status.pending_items?.['research']?.length ?? status.catalog?.['RQ'] ?? 0;
		}

		const hasUncommittedDiffs = stageUnstaged.length > 0;

		// Stage unbaselined: once generated, ready for initial baseline acceptance if uncommitted diffs exist (@spec JRN-003)
		if (!baseline) {
			return {
				status: 'needs-sync',
				badge: effectiveDrift > 0 ? `${effectiveDrift} drift` : 'unaccepted',
				canAccept: hasUncommittedDiffs
			};
		}

		if (effectiveDrift > 0 || pendingCount > 0) {
			return {
				status: 'needs-sync',
				badge: effectiveDrift > 0 ? `${effectiveDrift} drift` : `${pendingCount} pending`,
				canAccept: hasUncommittedDiffs
			};
		}

		return { status: 'synced', badge: 'synced', canAccept: false };
	}

	let acceptingStage = $state<string | null>(null);

	async function acceptStage(stage: PipelineStage) {
		if (acceptingStage) return;
		acceptingStage = stage.sync;
		try {
			const res = await project.acceptStage(stage.sync);
			if (!res.success) {
				console.error(`Failed to accept stage ${stage.id}:`, res.error);
				alert(`Failed to accept ${stage.label} stage:\n${res.error || 'Unknown error'}`);
			}
		} catch (e) {
			console.error(`Error accepting stage ${stage.id}:`, e);
			alert(`Error accepting ${stage.label} stage:\n${e}`);
		} finally {
			acceptingStage = null;
		}
	}

	function runStageSkill(stage: PipelineStage) {
		const action = getStageActionInfo(stage, project.status);
		if (!action.isActionable) return;
		const resolved = resolveStageExecution(stage, project.status);
		agent.run(resolved.skill, resolved.prompt, stage.id);
	}

	/**
	 * Synchronize a drifted stage by triggering `novel-sync` via the agent.
	 * @spec JRN-006
	 */
	function syncStage(stage: PipelineStage) {
		if (agent.status === 'running') return;
		project.setCurrentStage(stage.id);
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
				class:current={project.currentStage === stage.id}
				onclick={() => {
					project.setCurrentStage(stage.id);
					// Open main file for this stage
					if (stage.paths.length > 0) {
						project.openFile(stage.paths[0]);
					}
				}}
			>
				<div
					class="node-badge-row"
					onclick={() => {
						project.setCurrentStage(stage.id);
					}}
					onmouseenter={(e) => showHover('step', stage, i, st, e.currentTarget)}
					onmouseleave={hideHover}
				>
					<span class="node-step">{i + 1}</span>
					<span class="node-label">{stage.label}</span>
				</div>

				<div class="node-meta">
					{#if st.badge}
						{#if st.badge.includes('drift')}
							<button
								class="pill {st.status} drift-btn"
								disabled={agent.status === 'running'}
								onclick={(e) => {
									e.stopPropagation();
									syncStage(stage);
								}}
								onmouseenter={(e) => {
									e.stopPropagation();
									showHover('pill', stage, i, st, e.currentTarget);
								}}
								onmouseleave={hideHover}
							>
								{st.badge}
							</button>
						{:else}
							<span
								class="pill {st.status}"
								onclick={() => {
									project.setCurrentStage(stage.id);
								}}
								onmouseenter={(e) => {
									e.stopPropagation();
									showHover('pill', stage, i, st, e.currentTarget);
								}}
								onmouseleave={hideHover}
							>
								{st.badge}
							</span>
						{/if}
					{/if}
					{#if st.canAccept}
						<button
							class="pill accept-btn"
							disabled={acceptingStage === stage.sync}
							onclick={(e) => {
								e.stopPropagation();
								project.setCurrentStage(stage.id);
								acceptStage(stage);
							}}
						>
							{acceptingStage === stage.sync ? 'accepting...' : '✓ accept'}
						</button>
					{/if}
				</div>

				<button
					class="run-skill-btn"
					class:disabled={!action.isActionable}
					disabled={!action.isActionable || agent.status === 'running'}
					onclick={(e) => {
						e.stopPropagation();
						project.setCurrentStage(stage.id);
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
		padding: 8px 14px 6px 14px;
	}

	.stages-track {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		overflow-x: auto;
		padding: 4px 8px 8px 4px;
	}

	.stage-node {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 11px;
		border-radius: var(--radius);
		background: var(--paper);
		border: 1px solid var(--line);
		cursor: pointer;
		user-select: none;
		flex-shrink: 0;
		transition: all 0.18s ease;
	}
	.stage-node:not(.current) {
		box-shadow: 4px 5px 8px rgba(0, 0, 0, 0.38), 2px 3px 3px rgba(0, 0, 0, 0.22);
		transform: translateY(-1px);
	}
	:global([data-theme='dark']) .stage-node:not(.current) {
		box-shadow: 4px 5px 10px rgba(0, 0, 0, 0.8), 2px 3px 5px rgba(200, 70, 40, 0.55);
	}
	.stage-node:not(.current):hover {
		border-color: var(--line-strong);
	}

	/* @spec JRN-004 */
	.stage-node.current {
		border-color: rgba(158, 75, 28, 0.6);
		transform: translateY(1px);
		background:
			radial-gradient(
				ellipse at center,
				rgba(255, 255, 255, 0.6) 0%,
				rgba(255, 252, 232, 0.6) 20%,
				rgba(247, 231, 150, 0.6) 48%,
				rgba(230, 191, 74, 0.6) 68%,
				rgba(179, 111, 32, 0.6) 86%,
				rgba(138, 59, 18, 0.6) 100%
			),
			var(--paper);
	}
	.stage-node.current .node-step {
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
	}
	.stage-node.current .node-label {
		color: #2b2620;
		font-weight: 700;
	}
	.stage-node.current .pill.synced {
		color: #2e6239;
		background: rgba(46, 98, 57, 0.14);
		font-weight: 600;
	}
	.stage-node.current button.pill.drift-btn,
	.stage-node.current .pill.needs-sync {
		color: #7c2d12;
		border-color: rgba(124, 45, 18, 0.45);
		background: rgba(124, 45, 18, 0.12);
	}
	.stage-node.current .run-skill-btn {
		background: rgba(138, 59, 18, 0.15);
		color: #8a3b12;
	}
	.stage-node.current .run-skill-btn:hover:not(.disabled) {
		background: #8a3b12;
		color: #ffffff;
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
		color: var(--ink-soft);
		transition: color 0.15s ease;
	}
	.stage-node:hover .node-label {
		color: var(--ink);
	}

	.node-meta {
		display: flex;
		align-items: center;
		gap: 4px;
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
	button.pill.drift-btn {
		background: color-mix(in srgb, var(--warn) 15%, transparent);
		color: var(--warn);
		border: 1px solid color-mix(in srgb, var(--warn) 40%, transparent);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		font-weight: 600;
		transition: all 0.15s ease;
	}
	button.pill.drift-btn:hover:not(:disabled) {
		background: var(--warn);
		color: #fff;
		border-color: var(--warn);
	}
	button.pill.drift-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.pill.accept-btn {
		background: color-mix(in srgb, var(--ok) 18%, transparent);
		color: var(--ok);
		border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-weight: 600;
		transition: all 0.15s ease;
	}
	.pill.accept-btn:hover:not(:disabled) {
		background: var(--ok);
		color: #fff;
		border-color: var(--ok);
	}
	.pill.accept-btn:disabled {
		opacity: 0.6;
		cursor: wait;
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
