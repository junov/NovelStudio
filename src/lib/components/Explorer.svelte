<script lang="ts">
	/**
	 * Explorer sidebar: Story Bible and Files navigators with Git review/accept flow.
	 * @spec REV-001, REV-002, BBL-001, BBL-004
	 */
	import { onMount } from 'svelte';
	import { project } from '$lib/stores/project.svelte';
	import { PREFIXES, prefixOf, type Definition } from '$lib/entities';
	import { runSpecnovel } from '$lib/tauri';

	const DEFAULT_WIDTH = 280;
	const MIN_WIDTH = 200;
	const MAX_WIDTH = 600;

	type Tab = 'bible' | 'files';
	let currentTab = $state<Tab>('bible');
	let sidebarWidth = $state(DEFAULT_WIDTH);
	let isCollapsed = $state(false);
	let isDragging = $state(false);
	let collapsedSections = $state<Record<string, boolean>>({});

	function getBibleStorageKey(): string {
		return project.root
			? `novelstudio.bible_collapsed:${project.root}`
			: 'novelstudio.bible_collapsed';
	}

	$effect(() => {
		const key = getBibleStorageKey();
		const saved = localStorage.getItem(key) || localStorage.getItem('novelstudio.bible_collapsed');
		if (saved) {
			try {
				collapsedSections = JSON.parse(saved);
			} catch (e) {
				console.error(e);
			}
		}
	});

	function isSectionOpen(prefix: string, itemCount: number): boolean {
		if (prefix in collapsedSections) {
			return !collapsedSections[prefix];
		}
		return itemCount > 0;
	}

	function handleSectionToggle(prefix: string, isOpen: boolean) {
		collapsedSections[prefix] = !isOpen;
		const key = getBibleStorageKey();
		localStorage.setItem(key, JSON.stringify(collapsedSections));
		localStorage.setItem('novelstudio.bible_collapsed', JSON.stringify(collapsedSections));
	}

	onMount(() => {
		const savedWidth = localStorage.getItem('novelstudio.explorer_width');
		if (savedWidth) {
			const n = parseInt(savedWidth, 10);
			if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) {
				sidebarWidth = n;
			}
		}

		const savedCollapsed = localStorage.getItem('novelstudio.explorer_collapsed');
		if (savedCollapsed === 'true') {
			isCollapsed = true;
		}
	});

	function handlePointerDown(e: PointerEvent) {
		e.preventDefault();
		isDragging = true;
		const startX = e.clientX;
		const startWidth = sidebarWidth;
		document.body.style.userSelect = 'none';

		function onPointerMove(ev: PointerEvent) {
			const delta = ev.clientX - startX;
			const maxAllowed = Math.min(MAX_WIDTH, window.innerWidth * 0.5);
			const newWidth = Math.max(MIN_WIDTH, Math.min(maxAllowed, startWidth + delta));
			sidebarWidth = Math.round(newWidth);
			if (isCollapsed) {
				isCollapsed = false;
				localStorage.setItem('novelstudio.explorer_collapsed', 'false');
			}
		}

		function onPointerUp() {
			isDragging = false;
			document.body.style.userSelect = '';
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			localStorage.setItem('novelstudio.explorer_width', String(sidebarWidth));
		}

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
	}

	function handleDoubleClick() {
		sidebarWidth = DEFAULT_WIDTH;
		localStorage.setItem('novelstudio.explorer_width', String(DEFAULT_WIDTH));
	}

	function toggleCollapse() {
		isCollapsed = !isCollapsed;
		localStorage.setItem('novelstudio.explorer_collapsed', String(isCollapsed));
	}

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

<aside
	class="explorer-sidebar"
	class:collapsed={isCollapsed}
	class:dragging={isDragging}
	style="width: {isCollapsed ? '38px' : `${sidebarWidth}px`};"
>
	{#if isCollapsed}
		<div class="collapsed-strip">
			<button
				class="expand-btn icon-btn"
				onclick={toggleCollapse}
				title="Expand Navigation Pane"
				aria-label="Expand Navigation Pane"
			>
				»
			</button>
			<button
				class="strip-tab-btn"
				class:active={currentTab === 'bible'}
				onclick={() => {
					currentTab = 'bible';
					isCollapsed = false;
					localStorage.setItem('novelstudio.explorer_collapsed', 'false');
				}}
				title="Story Bible"
			>
				📖
			</button>
			<button
				class="strip-tab-btn"
				class:active={currentTab === 'files'}
				onclick={() => {
					currentTab = 'files';
					isCollapsed = false;
					localStorage.setItem('novelstudio.explorer_collapsed', 'false');
				}}
				title="Files"
			>
				📁
			</button>
		</div>
	{:else}
		<div
			class="resize-handle"
			class:dragging={isDragging}
			onpointerdown={handlePointerDown}
			ondblclick={handleDoubleClick}
			title="Drag to resize navigation pane (Double-click to reset)"
		></div>

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
				class:active={currentTab === 'files'}
				onclick={() => (currentTab = 'files')}
			>
				Files
			</button>
			<button
				class="collapse-btn icon-btn"
				onclick={toggleCollapse}
				title="Collapse Navigation Pane"
				aria-label="Collapse Navigation Pane"
			>
				«
			</button>
		</div>

	<div class="sidebar-content">
		{#if currentTab === 'bible'}
			<div class="entity-groups">
				{#each Object.entries(PREFIXES) as [prefix, info]}
					{@const items = groupedDefs()[prefix] || []}
					<details
						class="group-details"
						open={isSectionOpen(prefix, items.length)}
						ontoggle={(e) => handleSectionToggle(prefix, e.currentTarget.open)}
					>
						<summary class="group-summary">
							<span class="group-chevron" aria-hidden="true">
								<svg
									viewBox="0 0 16 16"
									width="12"
									height="12"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="4 6 8 10 12 6" />
								</svg>
							</span>
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
	{/if}
</aside>

<style>
	.explorer-sidebar {
		position: relative;
		flex-shrink: 0;
		background: var(--bg-elev);
		border-right: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		height: 100%;
		user-select: none;
		transition: width 0.15s ease;
	}

	.explorer-sidebar.dragging {
		transition: none;
	}

	.resize-handle {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 6px;
		cursor: col-resize;
		z-index: 10;
		transition: background 0.15s ease;
	}

	.resize-handle:hover,
	.resize-handle.dragging {
		background: var(--accent);
	}

	.collapsed-strip {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 0;
		gap: 8px;
		height: 100%;
		background: var(--bg-sunken);
	}

	.expand-btn {
		width: 26px;
		height: 26px;
		border-radius: var(--radius);
		border: 1px solid var(--line);
		background: var(--paper);
		color: var(--ink-soft);
		font-size: 14px;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.expand-btn:hover {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: var(--accent);
	}

	.strip-tab-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius);
		border: none;
		background: none;
		font-size: 14px;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.strip-tab-btn:hover {
		background: var(--bg-elev);
	}

	.strip-tab-btn.active {
		background: var(--paper);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.sidebar-tabs {
		display: flex;
		align-items: center;
		border-bottom: 1px solid var(--line);
		background: var(--bg-sunken);
	}

	.collapse-btn {
		width: 24px;
		height: 24px;
		margin-right: 6px;
		border-radius: var(--radius);
		border: none;
		background: none;
		color: var(--ink-faint);
		font-size: 13px;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: color 0.15s ease, background 0.15s ease;
	}

	.collapse-btn:hover {
		color: var(--ink);
		background: var(--paper);
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
		list-style: none;
		user-select: none;
	}
	.group-summary::-webkit-details-marker {
		display: none;
	}
	.group-summary:hover {
		background: var(--bg-sunken);
		color: var(--ink);
	}
	.group-chevron {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		margin-right: 4px;
		color: var(--ink-faint);
		transition: transform 0.15s ease, color 0.15s ease;
		flex-shrink: 0;
	}
	.group-summary:hover .group-chevron {
		color: var(--ink);
	}
	.group-details:not([open]) .group-chevron {
		transform: rotate(-90deg);
	}
	.group-details[open] .group-chevron {
		transform: rotate(0deg);
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
