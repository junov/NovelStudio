<script lang="ts">
	import { onMount } from 'svelte';
	import { project } from '$lib/stores/project.svelte';
	import { specnovelJson, runSpecnovel } from '$lib/tauri';
	import type { AuditJson } from '$lib/types';

	let auditData = $state<AuditJson | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state<string | null>(null);
	let isGeneratingReport = $state(false);

	async function loadAudit() {
		if (!project.root) return;
		isLoading = true;
		errorMessage = null;
		try {
			auditData = await specnovelJson<AuditJson>(project.root, ['audit']);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : String(e);
		} finally {
			isLoading = false;
		}
	}

	async function generateReport() {
		if (!project.root) return;
		isGeneratingReport = true;
		try {
			const res = await specnovelJson<{ report_path: string }>(project.root, ['audit', '--report']);
			if (res.report_path) {
				await project.refresh();
				project.openFile(res.report_path);
			}
		} catch (e) {
			console.error(e);
		} finally {
			isGeneratingReport = false;
		}
	}

	onMount(() => {
		loadAudit();
	});
</script>

<div class="analysis-view">
	<div class="analysis-header">
		<div>
			<h2 class="view-title">Developmental Editorial & Pacing Telemetry</h2>
			<p class="muted">
				Automated multi-dimensional analysis of story rhythm, character agency, Chekhov setups, and sensory grounding.
			</p>
		</div>

		<div class="header-btns">
			<button class="btn small ghost" onclick={loadAudit} disabled={isLoading}>
				↻ Refresh
			</button>
			<button class="btn small primary" onclick={generateReport} disabled={isGeneratingReport}>
				{isGeneratingReport ? 'Generating...' : 'Generate Full Report.md'}
			</button>
		</div>
	</div>

	<div class="analysis-content">
		{#if isLoading}
			<div class="loading-state">
				<p>Running developmental telemetry audit...</p>
			</div>
		{:else if errorMessage}
			<div class="error-card card">
				<h3>Audit Notice</h3>
				<p>{errorMessage}</p>
			</div>
		{:else if auditData}
			<!-- Summary Stats Cards -->
			<div class="stats-row">
				<div class="stat-card card">
					<span class="stat-label">Actual Words</span>
					<span class="stat-value">{auditData.summary.actual_words.toLocaleString()}</span>
					<span class="stat-sub">of {auditData.summary.target_words.toLocaleString()} target</span>
				</div>
				<div class="stat-card card">
					<span class="stat-label">Dialogue Ratio</span>
					<span class="stat-value">{Math.round(auditData.summary.overall_dialogue_ratio * 100)}%</span>
					<span class="stat-sub">across novel</span>
				</div>
				<div class="stat-card card">
					<span class="stat-label">Cadence Entropy</span>
					<span class="stat-value">{auditData.summary.average_cadence_entropy} bits</span>
					<span class="stat-sub">rhythm variety</span>
				</div>
				<div class="stat-card card">
					<span class="stat-label">Pacing Sags</span>
					<span class="stat-value" class:warn={auditData.summary.pacing_sags_detected > 0}>
						{auditData.summary.pacing_sags_detected}
					</span>
					<span class="stat-sub">sequences detected</span>
				</div>
			</div>

			<!-- Pacing Waveform -->
			<div class="card section-card">
				<h3 class="section-title">1. Pacing Waveform & Scene Rhythm</h3>
				<div class="waveform-table-wrapper">
					<table class="waveform-table">
						<thead>
							<tr>
								<th>#</th>
								<th>Scene</th>
								<th>Chapter</th>
								<th>Words</th>
								<th>Dialogue %</th>
								<th>Avg Sent</th>
								<th>Waveform Rhythm</th>
							</tr>
						</thead>
						<tbody>
							{#each auditData.waveform as w}
								<tr onclick={() => project.openId(w.scene)} class="clickable-row">
									<td class="muted">{w.index}</td>
									<td><strong class="scene-link">{w.scene}</strong> {w.title}</td>
									<td class="muted">{w.chapter}</td>
									<td>{w.actual_words}</td>
									<td>{Math.round(w.dialogue_ratio * 100)}%</td>
									<td>{w.avg_sentence_len.toFixed(1)}</td>
									<td>
										<div class="waveform-bar-box">
											<div
												class="waveform-bar"
												style="width: {Math.min(100, Math.max(4, (w.actual_words / 3000) * 100))}%"
											></div>
											{#if w.dialogue_ratio > 0.8}
												<span class="flag warn">HIGH DLG</span>
											{:else if w.actual_words > 0 && w.dialogue_ratio < 0.05}
												<span class="flag warn">LOW DLG</span>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Character Agency & Sensory -->
			<div class="split-row">
				<!-- Character Agency -->
				<div class="card section-card flex-1">
					<h3 class="section-title">2. Character Screen-Time Distribution</h3>
					<table class="simple-table">
						<thead>
							<tr>
								<th>ID</th>
								<th>Name</th>
								<th>POV Scenes</th>
								<th>Cast Scenes</th>
							</tr>
						</thead>
						<tbody>
							{#each auditData.character_agency as chr}
								<tr onclick={() => project.openId(chr.id)} class="clickable-row">
									<td class="chr-id">{chr.id}</td>
									<td>{chr.name}</td>
									<td>{chr.pov_count}</td>
									<td>{chr.cast_count}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Sensory Palette Radar -->
				<div class="card section-card flex-1">
					<h3 class="section-title">3. Sensory Grounding Palette</h3>
					<div class="sensory-bars">
						{#each Object.entries(auditData.sensory_palette) as [sense, count]}
							<div class="sensory-row">
								<span class="sense-name">{sense}</span>
								<div class="bar-container">
									<div
										class="sense-fill"
										style="width: {Math.min(100, count * 2)}%"
									></div>
								</div>
								<span class="sense-count">{count}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Chekhov's Gun Matrix -->
			{#if auditData.chekhov_matrix && auditData.chekhov_matrix.length > 0}
				<div class="card section-card">
					<h3 class="section-title">4. Chekhov's Gun Setup & Payoff Matrix</h3>
					<table class="simple-table">
						<thead>
							<tr>
								<th>Entity</th>
								<th>Plant Scene</th>
								<th>Payoff Scene</th>
								<th>Scene Gap</th>
								<th>Assessment</th>
							</tr>
						</thead>
						<tbody>
							{#each auditData.chekhov_matrix as ck}
								<tr>
									<td class="chr-id">{ck.entity}</td>
									<td>{ck.plant_scene}</td>
									<td>{ck.payoff_scene}</td>
									<td>{ck.scene_gap} scenes</td>
									<td><span class="assessment-badge">{ck.assessment}</span></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.analysis-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
		overflow-y: auto;
		padding: 24px 32px;
	}

	.analysis-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 20px;
	}
	.view-title {
		margin: 0 0 4px;
		font-size: 22px;
	}
	.header-btns {
		display: flex;
		gap: 8px;
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
		margin-bottom: 20px;
	}
	.stat-card {
		padding: 16px;
		display: flex;
		flex-direction: column;
	}
	.stat-label {
		font-size: 11px;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--ink-faint);
		letter-spacing: 0.06em;
	}
	.stat-value {
		font-size: 24px;
		font-weight: 700;
		font-family: var(--font-prose);
		margin: 4px 0 2px;
		color: var(--ink);
	}
	.stat-value.warn {
		color: var(--warn);
	}
	.stat-sub {
		font-size: 11px;
		color: var(--ink-faint);
	}

	.section-card {
		padding: 18px 20px;
		margin-bottom: 20px;
	}
	.section-title {
		margin: 0 0 14px;
		font-size: 15px;
	}

	.waveform-table-wrapper {
		overflow-x: auto;
	}
	.waveform-table,
	.simple-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12.5px;
	}
	.waveform-table th,
	.waveform-table td,
	.simple-table th,
	.simple-table td {
		padding: 6px 10px;
		border-bottom: 1px solid var(--line);
		text-align: left;
	}
	.waveform-table th,
	.simple-table th {
		background: var(--bg-sunken);
		font-weight: 600;
		color: var(--ink-soft);
	}

	.clickable-row {
		cursor: pointer;
	}
	.clickable-row:hover {
		background: var(--bg-sunken);
	}

	.scene-link {
		color: var(--accent);
	}
	.chr-id {
		font-family: var(--font-mono);
		color: var(--accent);
		font-weight: 600;
	}

	.waveform-bar-box {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.waveform-bar {
		height: 8px;
		background: var(--accent);
		border-radius: 4px;
		min-width: 4px;
	}
	.flag {
		font-size: 9.5px;
		font-weight: 700;
		padding: 1px 4px;
		border-radius: 3px;
	}
	.flag.warn {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.split-row {
		display: flex;
		gap: 20px;
		margin-bottom: 20px;
	}
	.flex-1 {
		flex: 1;
	}

	.sensory-bars {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.sensory-row {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 12.5px;
	}
	.sense-name {
		width: 80px;
		text-transform: capitalize;
		color: var(--ink-soft);
	}
	.bar-container {
		flex: 1;
		height: 10px;
		background: var(--bg-sunken);
		border-radius: 5px;
		overflow: hidden;
	}
	.sense-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 5px;
	}
	.sense-count {
		width: 30px;
		text-align: right;
		font-weight: 600;
		font-family: var(--font-mono);
	}

	.assessment-badge {
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--bg-sunken);
		font-size: 11px;
	}
</style>
