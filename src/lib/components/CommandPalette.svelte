<script lang="ts">
	import { onMount } from 'svelte';
	import { project } from '$lib/stores/project.svelte';
	import { PIPELINE, resolveStageExecution } from '$lib/stages';
	import { agent } from '$lib/agent/engine.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let query = $state('');
	let selectedIndex = $state(0);

	interface PaletteItem {
		id: string;
		type: 'entity' | 'file' | 'skill';
		title: string;
		subtitle?: string;
		action: () => void;
	}

	const allItems = $derived(() => {
		const items: PaletteItem[] = [];

		// 1. Entities
		for (const def of Object.values(project.defs)) {
			items.push({
				id: `ent_${def.id}`,
				type: 'entity',
				title: `${def.id}: ${def.title}`,
				subtitle: def.path,
				action: () => {
					project.openId(def.id);
					onClose();
				}
			});
		}

		// 2. Files
		for (const file of project.files) {
			items.push({
				id: `file_${file.path}`,
				type: 'file',
				title: file.path,
				action: () => {
					project.openFile(file.path);
					onClose();
				}
			});
		}

		// 3. Stage Actions
		for (const stage of PIPELINE) {
			const resolved = resolveStageExecution(stage, project.status);
			items.push({
				id: `stage_${stage.id}`,
				type: 'skill',
				title: `${resolved.isGenerated ? 'Sync' : 'Generate'} ${stage.label} (${resolved.skill})`,
				subtitle: stage.description,
				action: () => {
					agent.run(resolved.skill, resolved.prompt, stage.id);
					onClose();
				}
			});
		}

		return items;
	});

	const filteredItems = $derived(() => {
		const q = query.trim().toLowerCase();
		if (!q) return allItems().slice(0, 20);
		return allItems()
			.filter(
				(item) =>
					item.title.toLowerCase().includes(q) ||
					(item.subtitle && item.subtitle.toLowerCase().includes(q))
			)
			.slice(0, 25);
	});

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			const len = filteredItems().length;
			if (len > 0) selectedIndex = (selectedIndex + 1) % len;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			const len = filteredItems().length;
			if (len > 0) selectedIndex = (selectedIndex - 1 + len) % len;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const cur = filteredItems()[selectedIndex];
			if (cur) cur.action();
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="modal-backdrop" onclick={onClose}>
	<div class="palette-modal card" onclick={(e) => e.stopPropagation()}>
		<div class="search-input-box">
			<span class="search-icon">🔍</span>
			<input
				type="text"
				placeholder="Type an ID (CHR-001), filename, or command..."
				bind:value={query}
				autofocus
			/>
			<kbd>ESC</kbd>
		</div>

		<div class="palette-results">
			{#if filteredItems().length === 0}
				<div class="no-results">No matching items found</div>
			{/if}

			{#each filteredItems() as item, i}
				<div
					class="result-item"
					class:selected={i === selectedIndex}
					onclick={item.action}
					onmouseenter={() => (selectedIndex = i)}
				>
					<span class="item-icon">
						{#if item.type === 'entity'}
							✦
						{:else if item.type === 'file'}
							📄
						{:else}
							▶
						{/if}
					</span>
					<div class="item-texts">
						<span class="item-title">{item.title}</span>
						{#if item.subtitle}
							<span class="item-subtitle">{item.subtitle}</span>
						{/if}
					</div>
					<span class="item-type-tag">{item.type}</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.palette-modal {
		width: min(560px, 92vw);
		max-height: 480px;
		display: flex;
		flex-direction: column;
		padding: 0;
		overflow: hidden;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
	}

	.search-input-box {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--line);
		gap: 10px;
	}
	.search-icon {
		font-size: 16px;
		color: var(--ink-faint);
	}
	.search-input-box input {
		flex: 1;
		border: none;
		outline: none;
		background: transparent;
		font-size: 14px;
		padding: 0;
	}
	.search-input-box kbd {
		background: var(--bg-sunken);
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		font-size: 10px;
		padding: 2px 6px;
		font-family: var(--font-mono);
	}

	.palette-results {
		flex: 1;
		overflow-y: auto;
		padding: 6px;
	}

	.no-results {
		padding: 20px;
		text-align: center;
		color: var(--ink-faint);
		font-size: 13px;
	}

	.result-item {
		display: flex;
		align-items: center;
		padding: 8px 12px;
		border-radius: var(--radius);
		cursor: pointer;
		gap: 10px;
	}
	.result-item.selected {
		background: var(--accent-soft);
	}

	.item-icon {
		font-size: 14px;
		color: var(--accent);
		width: 18px;
		text-align: center;
	}
	.item-texts {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.item-title {
		font-size: 13px;
		font-weight: 500;
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}
	.item-subtitle {
		font-size: 11px;
		color: var(--ink-faint);
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}
	.item-type-tag {
		font-size: 9.5px;
		text-transform: uppercase;
		font-weight: 600;
		color: var(--ink-faint);
		background: var(--bg-sunken);
		padding: 2px 5px;
		border-radius: 3px;
	}
</style>
