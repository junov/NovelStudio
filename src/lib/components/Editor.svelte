<script lang="ts">
	/**
	 * Document viewer and Markdown editor with graphics preview, side-by-side diff mode, and target scrolling.
	 * @spec REV-003, EDT-001, EDT-002, BBL-003
	 */
	import { onMount, onDestroy } from 'svelte';
	import { project } from '$lib/stores/project.svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { wikiLinks } from '$lib/actions';
	import { isGraphic, isRasterImage, isBinary, isEditable, getMimeType } from '$lib/formats';
	import { getHeadFileContent } from '$lib/git';
	import { diffHighlighter } from '$lib/diffHighlight';
	import { EditorView, basicSetup } from 'codemirror';
	import { hoverTooltip } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { markdown } from '@codemirror/lang-markdown';
	import { ID_PATTERN } from '$lib/entities';
	import { wikiHover } from '$lib/wikiHover.svelte';

	interface Props {
		path: string;
		targetLine?: number;
		targetId?: string;
	}

	let { path, targetLine, targetId }: Props = $props();

	let mode = $state<'preview' | 'edit' | 'diff'>('preview');
	let content = $state('');
	let headContent = $state('');
	let graphicUrl = $state<string | null>(null);
	let isDirty = $state(false);
	let isSaving = $state(false);

	const hasUnstaged = $derived(() => project.hasUnstagedChanges(path));

	let wordCount = $derived(() => {
		const words = content.trim().match(/\S+/g);
		return words ? words.length : 0;
	});

	let previewContainer: HTMLDivElement | null = $state(null);
	let cmContainer: HTMLDivElement | null = $state(null);
	let cmHeadContainer: HTMLDivElement | null = $state(null);
	let cmView: EditorView | null = null;
	let cmHeadView: EditorView | null = null;
	let unbindScrollSync: (() => void) | null = null;

	// Backlinks referencing this file or ID
	const currentBacklinks = $derived(() => {
		const list = [];
		if (targetId && project.backlinks[targetId]) {
			list.push(...project.backlinks[targetId]);
		}
		// Also check by file path
		for (const [id, refs] of Object.entries(project.backlinks)) {
			if (project.defs[id]?.path === path) {
				list.push(...refs);
			}
		}
		return list;
	});

	function cleanupGraphic() {
		if (graphicUrl && graphicUrl.startsWith('blob:')) {
			URL.revokeObjectURL(graphicUrl);
			graphicUrl = null;
		}
	}

	function setMode(newMode: 'preview' | 'edit' | 'diff') {
		if (newMode === 'edit' && !isEditable(path)) {
			return;
		}
		if (newMode === 'diff' && !hasUnstaged()) {
			return;
		}
		mode = newMode;
	}

	function scrollToTarget(tId?: string, tLine?: number) {
		if (!tId && !tLine) return;

		// In preview mode, locate DOM elements, headings, or data-line attributes
		if (mode === 'preview') {
			let el: HTMLElement | null = null;
			if (tId) {
				el = document.getElementById(tId);
				if (!el) {
					el = document.querySelector(`.editor-body [data-id="${tId}"], .editor-body [data-wiki="${tId}"]`);
				}
				if (!el) {
					const headings = Array.from(
						document.querySelectorAll(
							'.editor-body h1, .editor-body h2, .editor-body h3, .editor-body h4, .editor-body h5, .editor-body h6, .editor-body [data-line]'
						)
					);
					el = (headings.find((h) => h.textContent?.includes(tId)) as HTMLElement) || null;
				}
			}
			if (!el && tLine) {
				el = document.querySelector(`.editor-body [data-line="${tLine}"]`) as HTMLElement;
			}

			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				el.classList.add('highlight-target');
				setTimeout(() => el?.classList.remove('highlight-target'), 2000);
				return;
			}
		}

		// In edit or diff mode, scroll the CodeMirror editor view(s)
		if (mode === 'edit' || mode === 'diff') {
			let targetLineNumber = tLine;
			if (!targetLineNumber && tId && cmView) {
				for (let i = 1; i <= cmView.state.doc.lines; i++) {
					const lineText = cmView.state.doc.line(i).text;
					if (lineText.includes(tId)) {
						targetLineNumber = i;
						break;
					}
				}
			}

			if (cmView && targetLineNumber) {
				try {
					const clamped = Math.min(Math.max(1, targetLineNumber), cmView.state.doc.lines);
					const lineObj = cmView.state.doc.line(clamped);
					cmView.dispatch({
						selection: { anchor: lineObj.from, head: lineObj.to },
						effects: EditorView.scrollIntoView(lineObj.from, { y: 'center' })
					});
				} catch (e) {
					console.error('Failed to scroll CodeMirror cmView:', e);
				}
			}

			// In diff mode, scroll the baseline HEAD view as well
			if (mode === 'diff' && cmHeadView) {
				let headLineNumber = tLine;
				if (!headLineNumber && tId) {
					for (let i = 1; i <= cmHeadView.state.doc.lines; i++) {
						const lineText = cmHeadView.state.doc.line(i).text;
						if (lineText.includes(tId)) {
							headLineNumber = i;
							break;
						}
					}
				}

				if (headLineNumber) {
					try {
						const clampedHead = Math.min(Math.max(1, headLineNumber), cmHeadView.state.doc.lines);
						const lineObjHead = cmHeadView.state.doc.line(clampedHead);
						cmHeadView.dispatch({
							selection: { anchor: lineObjHead.from, head: lineObjHead.to },
							effects: EditorView.scrollIntoView(lineObjHead.from, { y: 'center' })
						});
					} catch (e) {
						console.error('Failed to scroll CodeMirror cmHeadView:', e);
					}
				}
			}
		}
	}

	async function loadFile() {
		cleanupGraphic();
		try {
			if (project.root) {
				headContent = await getHeadFileContent(project.root, path);
			}

			if (!isEditable(path)) {
				mode = 'preview';
			} else if (mode === 'diff' && !hasUnstaged()) {
				mode = 'preview';
			}

			if (isGraphic(path)) {
				const mime = getMimeType(path);
				if (isRasterImage(path)) {
					const bytes = await project.readBytes(path);
					const blob = new Blob([new Uint8Array(bytes)], { type: mime });
					graphicUrl = URL.createObjectURL(blob);
					content = '';
				} else {
					// SVG text graphic
					const svgText = await project.read(path);
					content = svgText;
					graphicUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
				}
				isDirty = false;
				initEditors();
				return;
			}

			if (isBinary(path)) {
				content = '';
				isDirty = false;
				initEditors();
				return;
			}

			content = await project.read(path);
			isDirty = false;
			initEditors();
			if (targetId || targetLine) {
				setTimeout(() => {
					scrollToTarget(targetId, targetLine);
				}, 100);
			}
		} catch (e) {
			console.error(e);
		}
	}

	async function saveFile() {
		if (!isDirty || !isEditable(path)) return;
		isSaving = true;
		try {
			await project.write(path, content);
			isDirty = false;
			await project.refresh();
		} catch (e) {
			console.error('Failed to save file:', e);
		} finally {
			isSaving = false;
		}
	}

	function initEditors() {
		if (unbindScrollSync) {
			unbindScrollSync();
			unbindScrollSync = null;
		}
		if (cmView) {
			cmView.destroy();
			cmView = null;
		}
		if (cmHeadView) {
			cmHeadView.destroy();
			cmHeadView = null;
		}

		const WIKI_CM_RE = new RegExp(`\\[\\[\\s*(${ID_PATTERN})\\s*(?:\\|\\s*([^\\]]*?)\\s*)?\\]\\]`, 'g');

		const cmWikiTooltip = () =>
			hoverTooltip((view, pos, side) => {
				const line = view.state.doc.lineAt(pos);
				for (const match of line.text.matchAll(WIKI_CM_RE)) {
					const start = line.from + match.index!;
					const end = start + match[0].length;
					if (pos >= start && pos <= end) {
						const id = match[1];
						const startCoords = view.coordsAtPos(start);
						const endCoords = view.coordsAtPos(end);
						if (startCoords && endCoords) {
							const rect = new DOMRect(
								startCoords.left,
								startCoords.top,
								Math.max(20, endCoords.right - startCoords.left),
								Math.max(16, endCoords.bottom - startCoords.top)
							);
							wikiHover.show(id, rect);
						}
						return null;
					}
				}
				return null;
			});

		if ((mode === 'edit' || mode === 'diff') && isEditable(path) && cmContainer) {
			const leftExtensions = [
				basicSetup,
				markdown(),
				cmWikiTooltip(),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						content = update.state.doc.toString();
						isDirty = true;
					}
				})
			];
			if (mode === 'diff') {
				leftExtensions.push(diffHighlighter(() => headContent, true));
			}

			const startState = EditorState.create({
				doc: content,
				extensions: leftExtensions
			});
			cmView = new EditorView({
				state: startState,
				parent: cmContainer
			});
		}

		if (mode === 'diff' && cmHeadContainer) {
			const headState = EditorState.create({
				doc: headContent,
				extensions: [
					basicSetup,
					markdown(),
					cmWikiTooltip(),
					EditorState.readOnly.of(true),
					diffHighlighter(() => content, false)
				]
			});
			cmHeadView = new EditorView({
				state: headState,
				parent: cmHeadContainer
			});

			setTimeout(() => {
				const leftScroller = cmContainer?.querySelector('.cm-scroller');
				const rightScroller = cmHeadContainer?.querySelector('.cm-scroller');
				if (leftScroller && rightScroller) {
					let isSyncing = false;
					const onLeft = () => {
						if (isSyncing) return;
						isSyncing = true;
						rightScroller.scrollTop = leftScroller.scrollTop;
						rightScroller.scrollLeft = leftScroller.scrollLeft;
						requestAnimationFrame(() => { isSyncing = false; });
					};
					const onRight = () => {
						if (isSyncing) return;
						isSyncing = true;
						leftScroller.scrollTop = rightScroller.scrollTop;
						leftScroller.scrollLeft = rightScroller.scrollLeft;
						requestAnimationFrame(() => { isSyncing = false; });
					};
					leftScroller.addEventListener('scroll', onLeft);
					rightScroller.addEventListener('scroll', onRight);
					unbindScrollSync = () => {
						leftScroller.removeEventListener('scroll', onLeft);
						rightScroller.removeEventListener('scroll', onRight);
					};
				}
			}, 60);
		}
	}

	$effect(() => {
		// Re-load if path changes
		if (path) {
			loadFile();
		}
	});

	$effect(() => {
		// If mode changes, re-init editors and re-scroll
		if (mode) {
			setTimeout(() => {
				initEditors();
				if (targetId || targetLine) {
					setTimeout(() => {
						scrollToTarget(targetId, targetLine);
					}, 80);
				}
			}, 30);
		}
	});

	$effect(() => {
		// If unstaged changes disappear while in diff mode, return to preview
		if (!hasUnstaged() && mode === 'diff') {
			mode = 'preview';
		}
	});

	$effect(() => {
		// When targetId or targetLine updates (even within same file), scroll to target
		const _id = targetId;
		const _line = targetLine;
		const _p = path;
		if (_id || _line) {
			setTimeout(() => {
				scrollToTarget(_id, _line);
			}, 80);
		}
	});

	onDestroy(() => {
		cleanupGraphic();
		if (unbindScrollSync) unbindScrollSync();
		if (cmView) cmView.destroy();
		if (cmHeadView) cmHeadView.destroy();
	});

	// Auto-save on Ctrl+S
	function onKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			saveFile();
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="editor-view">
	<div class="editor-header">
		<div class="header-path">
			<span class="file-tag">FILE</span>
			<span class="path-text">{path}</span>
			{#if isDirty}
				<span class="dirty-dot" title="Unsaved changes">●</span>
			{/if}
		</div>

		<div class="header-actions">
			{#if !isBinary(path)}
				<span class="word-counter">{wordCount()} words</span>
			{/if}

			<div class="mode-toggle">
				<button
					class="toggle-btn"
					class:active={mode === 'preview'}
					onclick={() => setMode('preview')}
					title="Preview mode"
					aria-label="Preview mode"
				>
					<span class="mode-icon">👁</span> Preview
				</button>
				<button
					class="toggle-btn"
					class:active={mode === 'edit'}
					disabled={!isEditable(path)}
					onclick={() => setMode('edit')}
					title={isEditable(path) ? 'Edit mode' : 'Edit mode is not available for raster images and binary files'}
					aria-label="Edit mode"
				>
					<span class="mode-icon">✏️</span> Edit
				</button>
				{#if hasUnstaged()}
					<button
						class="toggle-btn diff-btn"
						class:active={mode === 'diff'}
						onclick={() => setMode('diff')}
						title="Diff mode (+/- unstaged changes)"
						aria-label="Diff mode"
					>
						<span class="mode-icon">+/-</span> Diff
					</button>
				{/if}
			</div>

			{#if isEditable(path)}
				<button
					class="btn small primary"
					disabled={!isDirty || isSaving}
					onclick={saveFile}
				>
					{isSaving ? 'Saving...' : 'Save'}
				</button>
			{/if}
		</div>
	</div>

	<div class="editor-body" class:diff-mode={mode === 'diff'}>
		{#if mode === 'preview'}
			{#if isGraphic(path) && graphicUrl}
				<div class="graphic-preview-container">
					<img src={graphicUrl} class="preview-graphic" alt={path} />
				</div>
			{:else if isBinary(path)}
				<div class="binary-preview-container">
					<span class="binary-icon">📦</span>
					<div class="binary-info">
						<p class="binary-title">Binary File</p>
						<p class="binary-path">{path}</p>
						<p class="binary-desc">Preview is not available for this binary format.</p>
					</div>
				</div>
			{:else}
				<div class="prose markdown-preview" use:wikiLinks bind:this={previewContainer}>
					{@html renderMarkdown(content, { titleOf: project.titleOf })}
				</div>
			{/if}
		{:else if mode === 'diff'}
			<div class="side-by-side-diff">
				<div class="diff-pane left-pane">
					<div class="pane-header">
						<span>New (Editable)</span>
						{#if isDirty}<span class="dirty-dot" title="Unsaved changes">●</span>{/if}
					</div>
					<div class="codemirror-wrapper diff-cm-wrapper" bind:this={cmContainer}></div>
				</div>
				<div class="diff-pane right-pane">
					<div class="pane-header">
						<span>Committed Baseline (HEAD)</span>
					</div>
					<div class="codemirror-wrapper diff-cm-wrapper" bind:this={cmHeadContainer}></div>
				</div>
			</div>
		{:else}
			<div class="codemirror-wrapper" bind:this={cmContainer}></div>
		{/if}
	</div>

	{#if currentBacklinks().length > 0}
		<div class="backlinks-drawer">
			<div class="backlinks-title">
				<span>Backlinks ({currentBacklinks().length})</span>
			</div>
			<div class="backlinks-list">
				{#each currentBacklinks() as ref}
					<div
						class="backlink-item"
						onclick={() => project.openFile(ref.path, ref.line)}
						title="{ref.path} (line {ref.line})"
					>
						<span class="ref-path">{ref.path}:{ref.line}</span>
						<span class="ref-snippet">{ref.snippet}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.editor-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--paper);
		overflow: hidden;
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 20px;
		border-bottom: 1px solid var(--line);
		background: var(--bg-elev);
		user-select: none;
	}

	.header-path {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 12.5px;
	}
	.file-tag {
		font-size: 10px;
		font-weight: 700;
		background: var(--bg-sunken);
		padding: 2px 6px;
		border-radius: 4px;
		color: var(--ink-faint);
	}
	.dirty-dot {
		color: var(--accent);
		font-size: 12px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.word-counter {
		font-size: 12px;
		color: var(--ink-faint);
	}

	.mode-toggle {
		display: flex;
		background: var(--bg-sunken);
		padding: 2px;
		border-radius: var(--radius);
		gap: 2px;
	}
	.toggle-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		background: none;
		border: none;
		font-size: 11.5px;
		font-weight: 500;
		padding: 3px 10px;
		border-radius: 4px;
		color: var(--ink-soft);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.toggle-btn:hover:not(:disabled) {
		color: var(--ink);
	}
	.toggle-btn.active {
		background: var(--paper);
		color: var(--ink);
		font-weight: 600;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}
	.toggle-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.mode-icon {
		font-size: 12px;
		line-height: 1;
		font-family: var(--font-mono);
	}

	.editor-body {
		flex: 1;
		overflow-y: auto;
		padding: 32px 40px;
	}
	.editor-body.diff-mode {
		padding: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.side-by-side-diff {
		display: flex;
		flex: 1;
		height: 100%;
		min-height: 0;
		width: 100%;
		gap: 0;
	}
	.diff-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		border: none;
		border-radius: 0;
		background: var(--paper);
	}
	.diff-pane.left-pane {
		border-right: 1px solid var(--line);
	}
	.pane-header {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 6px 12px;
		background: var(--bg-sunken);
		border-bottom: 1px solid var(--line);
		color: var(--ink-soft);
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
	}
	.left-pane .pane-header {
		color: var(--accent);
	}
	.right-pane .pane-header {
		color: var(--ink-faint);
	}

	.diff-cm-wrapper {
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	:global(.diff-cm-wrapper .cm-editor) {
		height: 100% !important;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	:global(.diff-cm-wrapper .cm-scroller) {
		height: 100% !important;
		flex: 1;
		overflow: auto !important;
	}
	:global(.diff-cm-wrapper .cm-scroller::-webkit-scrollbar) {
		width: 10px;
		height: 10px;
		display: block;
	}
	:global(.diff-cm-wrapper .cm-scroller::-webkit-scrollbar-thumb) {
		background: var(--line-strong);
		border-radius: 6px;
		border: 2px solid var(--paper);
	}
	:global(.diff-cm-wrapper .cm-scroller::-webkit-scrollbar-thumb:hover) {
		background: var(--ink-soft);
	}
	:global(.diff-cm-wrapper .cm-scroller::-webkit-scrollbar-track) {
		background: var(--bg-sunken);
	}

	:global(.diff-cm-wrapper .cm-diff-added) {
		background-color: rgba(46, 125, 50, 0.16) !important;
		border-left: 3px solid #2e7d32 !important;
	}
	:global(.diff-cm-wrapper .cm-diff-removed) {
		background-color: rgba(198, 40, 40, 0.16) !important;
		border-left: 3px solid #c62828 !important;
	}

	.graphic-preview-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100%;
		padding: 20px;
		box-sizing: border-box;
	}
	.preview-graphic {
		max-width: 100%;
		max-height: 85vh;
		width: auto;
		height: auto;
		object-fit: contain;
		display: block;
		border-radius: var(--radius);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		background: var(--bg);
	}

	.binary-preview-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		gap: 12px;
		color: var(--ink-faint);
	}
	.binary-icon {
		font-size: 48px;
	}
	.binary-info {
		text-align: center;
	}
	.binary-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--ink);
		margin: 0 0 4px 0;
	}
	.binary-path {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--ink-soft);
		margin: 0 0 8px 0;
	}
	.binary-desc {
		font-size: 13px;
		color: var(--ink-faint);
		margin: 0;
	}

	.markdown-preview {
		min-height: 100%;
		outline: none;
	}
	.markdown-preview :global(h1),
	.markdown-preview :global(h2),
	.markdown-preview :global(h3),
	.markdown-preview :global(h4) {
		scroll-margin-top: 40px;
	}
	:global(.highlight-target) {
		background: color-mix(in srgb, var(--accent) 18%, transparent) !important;
		border-radius: 4px;
		transition: background 0.8s ease;
	}

	.codemirror-wrapper {
		height: 100%;
		font-family: var(--font-mono);
		font-size: 13.5px;
	}

	.backlinks-drawer {
		border-top: 1px solid var(--line);
		background: var(--bg-elev);
		max-height: 160px;
		overflow-y: auto;
		padding: 8px 16px;
	}
	.backlinks-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
		margin-bottom: 6px;
	}
	.backlinks-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.backlink-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		padding: 3px 6px;
		border-radius: 4px;
		cursor: pointer;
	}
	.backlink-item:hover {
		background: var(--bg-sunken);
	}
	.ref-path {
		font-family: var(--font-mono);
		color: var(--accent);
		font-weight: 500;
	}
	.ref-snippet {
		color: var(--ink-soft);
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}
</style>
