<script lang="ts">
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

	let mode = $state<'rich' | 'source'>('rich');
	let content = $state('');
	let isDirty = $state(false);
	let isSaving = $state(false);
	let wordCount = $derived(() => {
		const words = content.trim().match(/\S+/g);
		return words ? words.length : 0;
	});

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

	async function loadFile() {
		try {
			content = await project.read(path);
			isDirty = false;
			initEditors();
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
		// If mode changes, re-init editors
		if (mode) {
			setTimeout(initEditors, 10);
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
		{#if mode === 'rich'}
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
