<script lang="ts">
	/**
	 * Document viewer and prose editor with wiki-link navigation and target scrolling.
	 * @spec BBL-003 (Issue #4)
	 */
	import { onMount, onDestroy } from 'svelte';
	import { project } from '$lib/stores/project.svelte';
	import { renderMarkdown } from '$lib/markdown';
	import { wikiLinks } from '$lib/actions';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { Markdown } from '@tiptap/markdown';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState } from '@codemirror/state';
	import { markdown } from '@codemirror/lang-markdown';

	interface Props {
		path: string;
		targetLine?: number;
		targetId?: string;
	}

	let { path, targetLine, targetId }: Props = $props();

	let mode = $state<'preview' | 'rich' | 'source'>('preview');
	let content = $state('');
	let isDirty = $state(false);
	let isSaving = $state(false);
	let wordCount = $derived(() => {
		const words = content.trim().match(/\S+/g);
		return words ? words.length : 0;
	});

	let previewContainer: HTMLDivElement | null = $state(null);
	let tiptapContainer: HTMLDivElement | null = $state(null);
	let cmContainer: HTMLDivElement | null = $state(null);
	let tiptapEditor: Editor | null = null;
	let cmView: EditorView | null = null;

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

	function scrollToTarget(tId?: string, tLine?: number) {
		if (!tId && !tLine) return;

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

		if (cmView && tLine) {
			try {
				const lineObj = cmView.state.doc.line(Math.min(Math.max(1, tLine), cmView.state.doc.lines));
				cmView.dispatch({
					selection: { anchor: lineObj.from },
					effects: EditorView.scrollIntoView(lineObj.from, { y: 'center' })
				});
			} catch (e) {
				console.error('Failed to scroll CodeMirror to line:', e);
			}
		}
	}

	async function loadFile() {
		try {
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
		if (!isDirty) return;
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
		// Clean up existing
		if (tiptapEditor) {
			tiptapEditor.destroy();
			tiptapEditor = null;
		}
		if (cmView) {
			cmView.destroy();
			cmView = null;
		}

		if (mode === 'rich' && tiptapContainer) {
			tiptapEditor = new Editor({
				element: tiptapContainer,
				extensions: [StarterKit, Markdown],
				content,
				onUpdate: ({ editor }) => {
					content = editor.storage.markdown.getMarkdown();
					isDirty = true;
				}
			});
		} else if (mode === 'source' && cmContainer) {
			const startState = EditorState.create({
				doc: content,
				extensions: [
					basicSetup,
					markdown(),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							content = update.state.doc.toString();
							isDirty = true;
						}
					})
				]
			});
			cmView = new EditorView({
				state: startState,
				parent: cmContainer
			});
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
					scrollToTarget(targetId, targetLine);
				}
			}, 30);
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
		if (tiptapEditor) tiptapEditor.destroy();
		if (cmView) cmView.destroy();
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
			<span class="word-counter">{wordCount()} words</span>

			<div class="mode-toggle">
				<button
					class="toggle-btn"
					class:active={mode === 'preview'}
					onclick={() => (mode = 'preview')}
				>
					Preview
				</button>
				<button
					class="toggle-btn"
					class:active={mode === 'rich'}
					onclick={() => (mode = 'rich')}
				>
					WYSIWYG
				</button>
				<button
					class="toggle-btn"
					class:active={mode === 'source'}
					onclick={() => (mode = 'source')}
				>
					Source
				</button>
			</div>

			<button
				class="btn small primary"
				disabled={!isDirty || isSaving}
				onclick={saveFile}
			>
				{isSaving ? 'Saving...' : 'Save'}
			</button>
		</div>
	</div>

	<div class="editor-body">
		{#if mode === 'preview'}
			<div class="prose markdown-preview" use:wikiLinks bind:this={previewContainer}>
				{@html renderMarkdown(content, { titleOf: project.titleOf })}
			</div>
		{:else if mode === 'rich'}
			<div class="prose tiptap-wrapper" use:wikiLinks bind:this={tiptapContainer}></div>
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
	}
	.toggle-btn {
		background: none;
		border: none;
		font-size: 11.5px;
		font-weight: 500;
		padding: 3px 8px;
		border-radius: 4px;
		color: var(--ink-soft);
	}
	.toggle-btn.active {
		background: var(--paper);
		color: var(--ink);
		font-weight: 600;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.editor-body {
		flex: 1;
		overflow-y: auto;
		padding: 32px 40px;
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

	.tiptap-wrapper {
		min-height: 100%;
		outline: none;
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
