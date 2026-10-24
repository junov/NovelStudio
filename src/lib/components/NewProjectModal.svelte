<script lang="ts">
	import { project } from '$lib/stores/project.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { agent } from '$lib/agent/engine.svelte';
	import { ensureDir, runSpecnovel, inTauri } from '$lib/tauri';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let projectPath = $state('');
	let title = $state('');
	let author = $state('');
	let synopsis = $state('');
	let isCreating = $state(false);
	let errorMessage = $state<string | null>(null);

	async function browseFolder() {
		if (inTauri()) {
			try {
				const { open } = await import('@tauri-apps/plugin-dialog');
				const selected = await open({ directory: true, multiple: false });
				if (typeof selected === 'string') {
					projectPath = selected;
				}
			} catch (e) {
				console.error(e);
			}
		}
	}

	async function handleCreate() {
		if (!projectPath.trim()) {
			errorMessage = 'Please specify a folder path for the new project.';
			return;
		}
		if (!synopsis.trim()) {
			errorMessage = 'Please provide an initial seed synopsis for the novel.';
			return;
		}

		isCreating = true;
		errorMessage = null;

		try {
			// 1. Ensure directory
			await ensureDir(projectPath);

			// 2. Run specnovel init
			await runSpecnovel(projectPath, ['init']);

			// 3. Open project
			await project.open(projectPath);
			settings.addRecent(projectPath, title || 'Untitled Novel');

			// 4. Save synopsis.md
			const synopsisHeader = `# Synopsis: ${title || 'Untitled Novel'}\n\n${synopsis.trim()}\n`;
			await project.write('story/synopsis.md', synopsisHeader);

			// 5. Update config.md if title/author given
			if (title || author) {
				let cfg = await project.read('story/config.md');
				if (title) cfg = cfg.replace(/- \*\*Title:\*\* .*/, `- **Title:** ${title}`);
				if (author) cfg = cfg.replace(/- \*\*Name:\*\* .*/, `- **Name:** ${author}`);
				await project.write('story/config.md', cfg);
			}

			await project.refresh();
			onClose();

			// 6. Launch novel-init interview!
			agent.run(
				'novel-init',
				`Run novel-init for this new project. The seed synopsis is saved in story/synopsis.md. Begin by reflecting your understanding and conducting the Stage 1 discovery interview with the author via the ask_user tool.`,
				'brief'
			);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : String(e);
		} finally {
			isCreating = false;
		}
	}
</script>

<div class="modal-backdrop" onclick={onClose}>
	<div class="modal card" onclick={(e) => e.stopPropagation()}>
		<h2>New SpecNovelist Project</h2>
		<p class="muted">
			Scaffolds a specification-first novel workspace with directory layout, templates, and launches the AI-guided discovery interview.
		</p>

		{#if errorMessage}
			<div class="error-banner">
				<span>⚠ {errorMessage}</span>
			</div>
		{/if}

		<div class="form-group">
			<label for="proj-path">Project Folder Location</label>
			<div class="folder-input-row">
				<input
					id="proj-path"
					type="text"
					placeholder="C:\Users\...\MyNovel"
					bind:value={projectPath}
				/>
				<button class="btn" onclick={browseFolder}>Browse...</button>
			</div>
		</div>

		<div class="form-row">
			<div class="form-group flex-1">
				<label for="proj-title">Novel Working Title</label>
				<input
					id="proj-title"
					type="text"
					placeholder="e.g. The Ice and the Iron"
					bind:value={title}
				/>
			</div>

			<div class="form-group flex-1">
				<label for="proj-author">Author / Pen Name</label>
				<input
					id="proj-author"
					type="text"
					placeholder="e.g. Elena Rostova"
					bind:value={author}
				/>
			</div>
		</div>

		<div class="form-group">
			<label for="proj-synopsis">
				Seed Synopsis
				<span class="muted font-normal">(a paragraph to a page describing the premise, protagonist, setting, and core conflict)</span>
			</label>
			<textarea
				id="proj-synopsis"
				rows="6"
				placeholder="In April 1912, physician Elena Voss boards the RMS Titanic under an assumed name to intercept Karl Weber before he delivers a stolen metallurgical patent in New York..."
				bind:value={synopsis}
			></textarea>
		</div>

		<div class="modal-actions">
			<button class="btn ghost" onclick={onClose} disabled={isCreating}>
				Cancel
			</button>
			<button class="btn primary" onclick={handleCreate} disabled={isCreating}>
				{isCreating ? 'Scaffolding...' : 'Create & Begin Interview →'}
			</button>
		</div>
	</div>
</div>

<style>
	.error-banner {
		padding: 8px 12px;
		background: color-mix(in srgb, var(--err) 15%, transparent);
		color: var(--err);
		border-radius: var(--radius);
		font-size: 12.5px;
		margin-bottom: 12px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
	}
	.form-group label {
		font-weight: 600;
		font-size: 12.5px;
	}
	.font-normal {
		font-weight: 400;
	}

	.form-row {
		display: flex;
		gap: 12px;
	}
	.flex-1 {
		flex: 1;
	}

	.folder-input-row {
		display: flex;
		gap: 8px;
	}
	.folder-input-row input {
		flex: 1;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 20px;
	}
</style>
