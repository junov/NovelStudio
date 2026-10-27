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
		type: 'step' | 'pill' | 'play' | 'accept';
		stage: PipelineStage;
		stageIndex: number;
		stageState: { status: 'needs-sync' | 'synced'; badge: string; canAccept?: boolean };
		targetRect: DOMRect;
		railRect: DOMRect;
	} | null>(null);

	function showHover(
		type: 'step' | 'pill' | 'play' | 'accept',
		stage: PipelineStage,
		stageIndex: number,
		stageState: { status: 'needs-sync' | 'synced'; badge: string; canAccept?: boolean },
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
		status: 'needs-sync' | 'synced';
		badge: string;
		canAccept: boolean;
	} {
		const status = project.status;
		if (!status) return { status: 'needs-sync', badge: '', canAccept: false };

		const syncName = stage.sync;
		const baseline = syncName ? status.baselines?.[syncName] : null;

		// Stages begin in needs-sync until generated for the first time (@spec JRN-005)
		const isGenerated =
			Boolean(baseline) ||
			Boolean(status.generatedStages?.[stage.id]) ||
			project.isStageGenerated(stage.id);

		if (!isGenerated) {
			return { status: 'needs-sync', badge: 'gen', canAccept: false };
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

		// Stage unbaselined: once generated, ready for initial baseline acceptance (@spec JRN-003, JRN-005)
		if (!baseline) {
			return {
				status: 'needs-sync',
				badge: effectiveDrift > 0 ? 'sync' : '',
				canAccept: true
			};
		}

		if (effectiveDrift > 0 || pendingCount > 0) {
			return {
				status: 'needs-sync',
				badge: 'sync',
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

	/**
	 * Run the appropriate skill for an action pill (GEN or SYNC).
	 * In gen mode (ungenerated stage), invokes `novel-generate` with stage.prompt.
	 * In sync mode (drifted/pending stage), invokes `novel-sync` with stage.syncPrompt.
	 * @spec JRN-006
	 */
	function runActionPill(stage: PipelineStage, mode: 'gen' | 'sync') {
		if (agent.status === 'running') return;
		const action = getStageActionInfo(stage, project.status);
		if (mode === 'gen' && !action.isActionable) return;
		project.setCurrentStage(stage.id);
		if (mode === 'gen') {
			agent.run(stage.skill, stage.prompt, stage.id);
		} else {
			agent.run(stage.syncSkill, stage.syncPrompt, stage.id);
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
		runActionPill(stage, 'sync');
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
						{#if st.badge === 'gen'}
							<button
								class="pill {st.status} gen-btn action-pill"
								class:disabled={!action.isActionable}
								disabled={!action.isActionable || agent.status === 'running'}
								onclick={(e) => {
									e.stopPropagation();
									runActionPill(stage, 'gen');
								}}
								onmouseenter={(e) => {
									e.stopPropagation();
									showHover('pill', stage, i, st, e.currentTarget);
								}}
								onmouseleave={hideHover}
							>
								{st.badge}
							</button>
						{:else if st.badge === 'sync' || st.badge.includes('drift')}
							<button
								class="pill {st.status} drift-btn sync-btn action-pill"
								disabled={agent.status === 'running'}
								onclick={(e) => {
									e.stopPropagation();
									runActionPill(stage, 'sync');
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
							onmouseenter={(e) => {
								e.stopPropagation();
								showHover('accept', stage, i, st, e.currentTarget);
							}}
							onmouseleave={hideHover}
						>
							{acceptingStage === stage.sync ? 'accepting...' : '✓ accept'}
						</button>
					{/if}
				</div>
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
			unstagedFiles={project.unstagedFiles}
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
	/* @spec JRN-004 */
	.stage-node:not(.current) {
		box-shadow: 4px 5px 8px rgba(0, 0, 0, 0.38), 2px 3px 3px rgba(0, 0, 0, 0.22);
		transform: translateY(-1px);
		background:
			radial-gradient(
				ellipse at center,
				rgba(255, 255, 255, 0.25) 0%,
				rgba(245, 240, 230, 0.2) 25%,
				rgba(220, 205, 185, 0.18) 55%,
				rgba(160, 135, 110, 0.16) 80%,
				rgba(110, 75, 45, 0.18) 100%
			),
			var(--paper);
	}
	:global([data-theme='dark']) .stage-node:not(.current) {
		box-shadow: 4px 5px 10px rgba(0, 0, 0, 0.8), 2px 3px 5px rgba(200, 70, 40, 0.55);
		background:
			radial-gradient(
				ellipse at center,
				rgba(255, 255, 255, 0.04) 0%,
				rgba(40, 35, 30, 0.2) 30%,
				rgba(25, 20, 15, 0.4) 70%,
				rgba(15, 10, 8, 0.65) 100%
			),
			var(--paper);
	}
	.stage-node:not(.current):hover {
		border-color: var(--line-strong);
	}

	/* @spec JRN-004 */
	.stage-node.current {
		border-color: var(--line-strong);
		transform: translateY(1px);
		background:
			radial-gradient(
				ellipse at center,
				rgba(255, 255, 255, 0.25) 0%,
				rgba(245, 240, 230, 0.2) 25%,
				rgba(220, 205, 185, 0.18) 55%,
				rgba(160, 135, 110, 0.16) 80%,
				rgba(110, 75, 45, 0.18) 100%
			),
			#ffffff;
	}
	:global([data-theme='dark']) .stage-node.current {
		background:
			radial-gradient(
				ellipse at center,
				rgba(255, 255, 255, 0.04) 0%,
				rgba(40, 35, 30, 0.2) 30%,
				rgba(25, 20, 15, 0.4) 70%,
				rgba(15, 10, 8, 0.65) 100%
			),
			#36322a;
	}
	.stage-node.current .node-step {
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
	}
	.stage-node.current .node-label {
		color: var(--ink);
		font-weight: 700;
	}
	.stage-node.current .pill.synced {
		color: var(--ok);
		background: color-mix(in srgb, var(--ok) 18%, transparent);
	}
	.stage-node.current button.pill.drift-btn,
	.stage-node.current button.pill.sync-btn,
	.stage-node.current .pill.needs-sync {
		color: var(--warn);
		border-color: color-mix(in srgb, var(--warn) 45%, transparent);
		background: color-mix(in srgb, var(--warn) 15%, transparent);
	}
	.stage-node.current button.pill.gen-btn {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		background: color-mix(in srgb, var(--accent) 15%, transparent);
	}
	.stage-node.current button.pill.gen-btn:hover:not(:disabled) {
		background: var(--accent);
		color: var(--accent-ink);
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
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.pill.synced {
		background: color-mix(in srgb, var(--ok) 15%, transparent);
		color: var(--ok);
	}
	.pill.needs-sync {
		background: color-mix(in srgb, var(--warn) 15%, transparent);
		color: var(--warn);
	}
	button.pill.drift-btn,
	button.pill.sync-btn {
		background: color-mix(in srgb, var(--warn) 15%, transparent);
		color: var(--warn);
		border: 1px solid color-mix(in srgb, var(--warn) 40%, transparent);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		font-weight: 600;
		transition: all 0.15s ease;
	}
	button.pill.drift-btn:hover:not(:disabled),
	button.pill.sync-btn:hover:not(:disabled) {
		background: var(--warn);
		color: #fff;
		border-color: var(--warn);
	}
	button.pill.drift-btn:disabled,
	button.pill.sync-btn:disabled {
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

	button.pill.gen-btn {
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		font-weight: 600;
		transition: all 0.15s ease;
	}
	button.pill.gen-btn:hover:not(:disabled) {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: var(--accent);
	}
	button.pill.gen-btn:disabled,
	button.pill.gen-btn.disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.stage-connector {
		flex: 1;
		height: 2px;
		background: var(--line);
		min-width: 8px;
	}
</style>
