<script lang="ts">
	import { project } from '$lib/stores/project.svelte';
	import { runSpecnovel } from '$lib/tauri';

	let format = $state<'epub' | 'pdf' | 'docx' | 'md'>('epub');
	let isCompiling = $state(false);
	let outputLog = $state<string | null>(null);
	let buildSuccess = $state(false);

	async function handleCompile() {
		if (!project.root) return;
		isCompiling = true;
		outputLog = null;
		buildSuccess = false;

		try {
			const res = await runSpecnovel(project.root, ['compile', '--format', format]);
			outputLog = res.stdout + (res.stderr ? `\n[stderr]\n${res.stderr}` : '');
			buildSuccess = res.code === 0;
			await project.refresh();
		} catch (e) {
			outputLog = e instanceof Error ? e.message : String(e);
			buildSuccess = false;
		} finally {
			isCompiling = false;
		}
	}
</script>

<div class="book-preview-view">
	<div class="preview-header">
		<div>
			<h2 class="view-title">Book Publication & Compilation Studio</h2>
			<p class="muted">
				Compiles your finished or draft novel in reading order into publication-ready book formats (EPUB, PDF, DOCX, Markdown).
			</p>
		</div>

		<div class="compile-bar">
			<label class="format-select-label">
				<span>Format:</span>
				<select bind:value={format}>
					<option value="epub">EPUB (e-reader)</option>
					<option value="pdf">PDF (interior book)</option>
					<option value="docx">Word (.docx)</option>
					<option value="md">Assembled Markdown</option>
				</select>
			</label>

			<button
				class="btn primary"
				onclick={handleCompile}
				disabled={isCompiling}
			>
				{isCompiling ? 'Compiling book...' : `Compile ${format.toUpperCase()}`}
			</button>
		</div>
	</div>

	{#if outputLog}
		<div class="compile-log-card card" class:success={buildSuccess}>
			<div class="log-header">
				<span>Compilation Output</span>
				{#if buildSuccess}
					<span class="badge ok">Built in build/</span>
				{:else}
					<span class="badge err">Errors</span>
				{/if}
			</div>
			<pre class="log-pre"><code>{outputLog}</code></pre>
		</div>
	{/if}

	<div class="preview-book-frame card">
		<div class="book-cover-sim">
			<div class="cover-inner">
				<h1 class="book-title">{project.title}</h1>
				<span class="book-ornament">❦</span>
				<p class="book-status">
					{project.status?.words.manuscript.toLocaleString() || 0} manuscript words · {project.status?.scenes.outline || 0} scenes
				</p>
			</div>
		</div>

		<div class="publication-specs">
			<h3>Publication Settings & Front/Back Matter</h3>
			<ul class="specs-list">
				<li>
					<strong>Mandatory Acknowledgements:</strong> Verbatim AI model disclosure from <code>story/acknowledgements.md</code> is automatically injected.
				</li>
				<li>
					<strong>Style-Guided Glossary:</strong> Terms from <code>kb/glossary/</code> injected per guidelines in <code>story/style.md</code>.
				</li>
				<li>
					<strong>DAG-Filtered Bibliography:</strong> Researched sources citing active scenes are compiled in reading order.
				</li>
				<li>
					<strong>Typography & Gutter Margins:</strong> Formatted to interior trim specs declared in <code>story/style.md</code>.
				</li>
			</ul>
		</div>
	</div>
</div>

<style>
	.book-preview-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
		overflow-y: auto;
		padding: 24px 32px;
	}

	.preview-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 24px;
	}
	.view-title {
		margin: 0 0 4px;
		font-size: 22px;
	}

	.compile-bar {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.format-select-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 500;
		font-size: 13px;
	}

	.compile-log-card {
		padding: 14px 18px;
		margin-bottom: 20px;
	}
	.compile-log-card.success {
		border-color: var(--ok);
	}
	.log-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-weight: 600;
	}
	.log-pre {
		margin: 0;
		background: var(--bg-sunken);
		padding: 10px;
		border-radius: var(--radius);
		font-size: 12px;
		max-height: 180px;
		overflow-y: auto;
	}

	.preview-book-frame {
		display: flex;
		padding: 32px;
		gap: 40px;
		background: var(--paper);
	}

	.book-cover-sim {
		width: 240px;
		height: 340px;
		background: var(--bg-sunken);
		border: 2px solid var(--line-strong);
		border-radius: 6px;
		box-shadow: var(--shadow);
		display: flex;
		flex-direction: column;
		justify-content: center;
		text-align: center;
		padding: 20px;
	}
	.book-title {
		font-size: 24px;
		margin: 0 0 10px;
		color: var(--ink);
	}
	.book-ornament {
		font-size: 28px;
		color: var(--accent);
		margin: 12px 0;
	}
	.book-status {
		font-size: 11.5px;
		color: var(--ink-faint);
		margin: 0;
	}

	.publication-specs {
		flex: 1;
	}
	.publication-specs h3 {
		margin-top: 0;
	}
	.specs-list {
		padding-left: 20px;
		line-height: 1.7;
		font-size: 13px;
		color: var(--ink-soft);
	}
	.specs-list code {
		font-family: var(--font-mono);
		font-size: 12px;
		background: var(--bg-sunken);
		padding: 1px 4px;
		border-radius: 3px;
	}
</style>
