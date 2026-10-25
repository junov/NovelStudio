<script lang="ts">
	/**
	 * Explorer sidebar: Story Bible, Outline, and Files navigators with Git review/accept flow.
	 * @spec REV-001, REV-002, BBL-001
	 */
	import { project } from '$lib/stores/project.svelte';
	import { PREFIXES, prefixOf, type Definition } from '$lib/entities';
	import { runSpecnovel } from '$lib/tauri';

	type Tab = 'bible' | 'outline' | 'files';
	let currentTab = $state<Tab>('bible');

	// Group definitions by entity prefix
	const groupedDefs = $derived(() => {
		const groups: Record<string, Definition[]> = {};
		for (const def of Object.values(project.defs)) {
			const pre = prefixOf(def.id);
			(groups[pre] ??= []).push(def);
		}
		for (const k of Object.keys(groups)) {
			groups[k].sort((a, b) => a.id.localeCompare(b.id));
		}
		return groups;
	});

	// Outline scenes in reading order
	const outlineScenes = $derived(() => {
		return Object.values(project.defs)
			.filter((d) => d.id.startsWith('SCN-') && d.path.startsWith('outline/'))
			.sort((a, b) => a.line - b.line);
	});

	// Quick create next entity
	async function createNextEntity(prefix: string) {
		if (!project.root) return;
		try {
			const res = await runSpecnovel(project.root, ['next-id', prefix]);
			const nextId = res.stdout.trim();
			if (nextId) {
				const info = PREFIXES[prefix];
				const targetFile = info ? `${info.folder}/${nextId}.md` : `kb/${nextId}.md`;
				const template = `# ${nextId}: Untitled\n\n- **Status:** open\n`;
				await project.write(targetFile, template);
				await project.refresh();
				project.openFile(targetFile);
			}
		} catch (e) {
			console.error(e);
		}
	}
</script>

<aside class="explorer-sidebar">
	<div class="sidebar-tabs">
		<button
			class="tab-btn"
			class:active={currentTab === 'bible'}
			onclick={() => (currentTab = 'bible')}
		>
			Story Bible
		</button>
		<button
			class="tab-btn"
			class:active={currentTab === 'outline'}
			onclick={() => (currentTab = 'outline')}
		>
			Outline
		</button>
		<button
			class="tab-btn"
			class:active={currentTab === 'files'}
			onclick={() => (currentTab = 'files')}
		>
			Files
		</button>
	</div>

	<div class="sidebar-content">
		{#if currentTab === 'bible'}
			<div class="entity-groups">
				{#each Object.entries(PREFIXES) as [prefix, info]}
					{@const items = groupedDefs()[prefix] || []}
					<details class="group-details" open={items.length > 0}>
						<summary class="group-summary">
							<span class="group-icon">{info.icon}</span>
							<span class="group-title">{info.plural}</span>
							<span class="group-count">{items.length}</span>
							<button
								class="add-item-btn"
								onclick={(e) => {
									e.stopPropagation();
									createNextEntity(prefix);
								}}
								title="Add next {info.label}"
							>
								+
							</button>
						</summary>

						<div class="group-items">
							{#each items as item}
								<div
									class="entity-item"
									onclick={() => project.openId(item.id)}
									title="{item.id}: {item.title}"
								>
									<span class="entity-id" style="color: hsl({info.hue} 60% 45%)">{item.id}</span>
									<span class="entity-name">{item.title}</span>
									{#if project.hasItemUnstagedChanges(item.id)}
										<span class="change-cue" title="Unstaged changes">●</span>
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div class="review-actions" onclick={(e) => e.stopPropagation()}>
											<button
												class="review-btn accept"
												onclick={() => project.acceptItem(item.id)}
												title="Accept unstaged changes for {item.id}"
											>
												Accept
											</button>
											<button
												class="review-btn revert"
												onclick={() => project.revertItem(item.id)}
												title="Revert unstaged changes for {item.id}"
											>
												Revert
											</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</details>
				{/each}
			</div>
		{:else if currentTab === 'outline'}
			<div class="outline-list">
				<div class="section-header">
					<span>Scenes ({outlineScenes().length})</span>
					<button
						class="btn small ghost"
						onclick={() => project.openFile('outline/outline.md')}
					>
						Edit outline.md
					</button>
				</div>
				{#each outlineScenes() as scn}
					<div class="scene-item" onclick={() => project.openId(scn.id)}>
						<span class="scn-id">{scn.id}</span>
						<span class="scn-title">{scn.title}</span>
						{#if project.hasItemUnstagedChanges(scn.id)}
							<span class="change-cue" title="Unstaged changes">●</span>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="review-actions" onclick={(e) => e.stopPropagation()}>
								<button
									class="review-btn accept"
									onclick={() => project.acceptItem(scn.id)}
									title="Accept unstaged changes for {scn.id}"
								>
									Accept
								</button>
								<button
									class="review-btn revert"
									onclick={() => project.revertItem(scn.id)}
									title="Revert unstaged changes for {scn.id}"
								>
									Revert
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="file-tree">
				{#each project.files as file}
					<div
						class="file-item"
						class:active={project.view.kind === 'file' && project.view.path === file.path}
						onclick={() => project.openFile(file.path)}
					>
						<span class="file-icon">{file.path.endsWith('.md') ? '📄' : '📁'}</span>
						<span class="file-path">{file.path}</span>
						{#if project.hasUnstagedChanges(file.path)}
							<span class="change-cue" title="Unstaged changes">●</span>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="review-actions" onclick={(e) => e.stopPropagation()}>
								<button
									class="review-btn accept"
									onclick={() => project.acceptFile(file.path)}
									title="Accept unstaged changes for {file.path}"
								>
									Accept
								</button>
								<button
									class="review-btn revert"
									onclick={() => project.revertFile(file.path)}
									title="Revert unstaged changes for {file.path}"
								>
									Revert
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</aside>

<style>
	.explorer-sidebar {
		width: 280px;
		background: var(--bg-elev);
		border-right: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		height: 100%;
		user-select: none;
	}

	.sidebar-tabs {
		display: flex;
		border-bottom: 1px solid var(--line);
		background: var(--bg-sunken);
	}
	.tab-btn {
		flex: 1;
		padding: 8px 6px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-faint);
		cursor: pointer;
	}
	.tab-btn:hover {
		color: var(--ink);
	}
	.tab-btn.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
		background: var(--bg-elev);
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.group-details {
		margin-bottom: 2px;
	}
	.group-summary {
		display: flex;
		align-items: center;
		padding: 6px 12px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--ink-soft);
		cursor: pointer;
	}
	.group-summary:hover {
		background: var(--bg-sunken);
	}
	.group-icon {
		margin-right: 6px;
		font-size: 13px;
	}
	.group-title {
		flex: 1;
	}
	.group-count {
		font-size: 11px;
		color: var(--ink-faint);
		margin-right: 8px;
	}
	.add-item-btn {
		width: 18px;
		height: 18px;
		border-radius: 4px;
		border: 1px solid var(--line);
		background: var(--paper);
		font-size: 12px;
		line-height: 1;
		display: grid;
		place-items: center;
		cursor: pointer;
	}
	.add-item-btn:hover {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: var(--accent);
	}

	.group-items {
		padding-left: 24px;
	}
	.entity-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		font-size: 12px;
		cursor: pointer;
		border-radius: 4px;
		margin: 1px 4px;
	}
	.entity-item:hover {
		background: var(--bg-sunken);
	}
	.entity-id {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 11px;
	}
	.entity-name {
		color: var(--ink);
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		font-weight: 600;
		font-size: 12px;
		color: var(--ink-soft);
	}
	.scene-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		font-size: 12px;
		cursor: pointer;
	}
	.scene-item:hover {
		background: var(--bg-sunken);
	}
	.scn-id {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--accent);
		font-weight: 600;
	}
	.scn-title {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}

	.file-tree {
		padding: 4px 0;
	}
	.file-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		font-size: 12px;
		cursor: pointer;
	}
	.file-item:hover {
		background: var(--bg-sunken);
	}
	.file-item.active {
		background: var(--accent-soft);
		color: var(--accent);
		font-weight: 500;
	}
	.file-path {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: 11.5px;
	}

	.change-cue {
		color: var(--accent);
		font-size: 10px;
		margin-left: 4px;
		flex-shrink: 0;
	}
	.review-actions {
		display: flex;
		align-items: center;
		gap: 3px;
		margin-left: auto;
		flex-shrink: 0;
	}
	.review-btn {
		font-size: 10px;
		font-weight: 600;
		padding: 1px 5px;
		border-radius: 3px;
		border: 1px solid var(--line);
		cursor: pointer;
		line-height: 1.2;
		transition: all 0.12s ease;
	}
	.review-btn.accept {
		background: color-mix(in srgb, #2e7d32 15%, transparent);
		color: #2e7d32;
		border-color: color-mix(in srgb, #2e7d32 40%, transparent);
	}
	.review-btn.accept:hover {
		background: #2e7d32;
		color: white;
	}
	.review-btn.revert {
		background: color-mix(in srgb, #c62828 15%, transparent);
		color: #c62828;
		border-color: color-mix(in srgb, #c62828 40%, transparent);
	}
	.review-btn.revert:hover {
		background: #c62828;
		color: white;
	}
</style>
