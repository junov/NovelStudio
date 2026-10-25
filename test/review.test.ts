// @spec REV-001, REV-002, REV-003, REV-004
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parsePorcelainStatus } from '../src/lib/git';
import { computeDiffDecorations } from '../src/lib/diffHighlight';
import { Text } from '@codemirror/state';
import { project } from '../src/lib/stores/project.svelte';
import { AGENT_TOOLS } from '../src/lib/agent/tools';

describe('REV-001: Unstaged Change Tracking and Navigator Visual Cues', () => {
	const explorerSrc = readFileSync(resolve(__dirname, '../src/lib/components/Explorer.svelte'), 'utf-8');

	// @spec REV-001
	it('parses porcelain status into set of unstaged file paths', () => {
		const porcelain = ` M story/brief.md\n?? kb/characters/CHR-001.md\n D outline/scenes/SCN-002.md\nAM story/synopsis.md\n`;
		const unstaged = parsePorcelainStatus(porcelain);

		expect(unstaged.has('story/brief.md')).toBe(true);
		expect(unstaged.has('kb/characters/CHR-001.md')).toBe(true);
		expect(unstaged.has('outline/scenes/SCN-002.md')).toBe(true);
		expect(unstaged.has('story/synopsis.md')).toBe(true);
		expect(unstaged.has('clean/file.md')).toBe(false);
	});

	// @spec REV-001
	it('maps entity definitions to unstaged status in project store', () => {
		project.defs = {
			'CHR-001': { id: 'CHR-001', title: 'Elena', path: 'kb/characters/CHR-001.md', line: 1 }
		};
		project.unstagedFiles = new Set(['kb/characters/CHR-001.md']);

		expect(project.hasUnstagedChanges('kb/characters/CHR-001.md')).toBe(true);
		expect(project.hasItemUnstagedChanges('CHR-001')).toBe(true);

		expect(project.hasUnstagedChanges('kb/places/PLC-001.md')).toBe(false);
		expect(project.hasItemUnstagedChanges('PLC-001')).toBe(false);
	});

	// @spec REV-001
	it('renders visual cues for modified items across Story Bible and Files navigators', () => {
		expect(explorerSrc).toContain('class="change-cue"');
		expect(explorerSrc).toContain('hasItemUnstagedChanges(item.id)');
		expect(explorerSrc).toContain('hasUnstagedChanges(file.path)');
		// Redundant Outline tab is removed; outline items are consolidated in Story Bible
		expect(explorerSrc).not.toContain("currentTab === 'outline'");
	});
});

describe('REV-002: Navigator Item and File Accept and Revert Actions', () => {
	const explorerSrc = readFileSync(resolve(__dirname, '../src/lib/components/Explorer.svelte'), 'utf-8');

	// @spec REV-002
	it('renders paired Accept and Revert buttons next to modified items and files', () => {
		expect(explorerSrc).toContain('class="review-btn accept"');
		expect(explorerSrc).toContain('class="review-btn revert"');
		expect(explorerSrc).toContain('project.acceptItem');
		expect(explorerSrc).toContain('project.revertItem');
		expect(explorerSrc).toContain('project.acceptFile');
		expect(explorerSrc).toContain('project.revertFile');
	});

	// @spec REV-002
	it('provides project store actions to accept and revert files and items', () => {
		expect(typeof project.acceptFile).toBe('function');
		expect(typeof project.revertFile).toBe('function');
		expect(typeof project.acceptItem).toBe('function');
		expect(typeof project.revertItem).toBe('function');
	});
});

describe('REV-003: Side-by-Side Editable Diff Mode in Document View', () => {
	const editorSrc = readFileSync(resolve(__dirname, '../src/lib/components/Editor.svelte'), 'utf-8');

	// @spec REV-003
	it('only shows the diff mode toggle button when unstaged changes exist', () => {
		expect(editorSrc).toContain('hasUnstaged()');
		expect(editorSrc).toContain('class="toggle-btn diff-btn"');
		expect(editorSrc).toContain('<span class="mode-icon">+/-</span> Diff');
	});

	// @spec REV-003
	it('renders side-by-side diff with editable left pane and read-only right pane', () => {
		expect(editorSrc).toContain('side-by-side-diff');
		expect(editorSrc).toContain('left-pane');
		expect(editorSrc).toContain('right-pane');
		expect(editorSrc).toContain('New (Editable)');
		expect(editorSrc).toContain('Committed Baseline (HEAD)');
		expect(editorSrc).toContain('EditorState.readOnly.of(true)');
	});

	// @spec REV-003
	it('provides visible scrollbars and CodeMirror scroll containers in diff mode', () => {
		expect(editorSrc).toContain('diff-cm-wrapper');
		expect(editorSrc).toContain('.cm-scroller');
		expect(editorSrc).toContain('overflow: auto');
		expect(editorSrc).toContain('::-webkit-scrollbar');
	});

	// @spec REV-003
	it('scrolls target items into view in diff mode across both CodeMirror views', () => {
		expect(editorSrc).toContain("mode === 'diff' && cmHeadView");
		expect(editorSrc).toContain('clampedHead');
		expect(editorSrc).toContain('EditorView.scrollIntoView');
	});

	// @spec REV-003
	it('highlights differences with visual diff styling in diff mode', () => {
		expect(editorSrc).toContain('diffHighlighter');
		expect(editorSrc).toContain('.cm-diff-added');
		expect(editorSrc).toContain('.cm-diff-removed');
	});

	// @spec REV-003
	it('computes line-level additions and deletions correctly', () => {
		const doc = Text.of(['Line 1', 'Line 2 modified', 'Line 3']);
		const baseline = 'Line 1\nLine 2\nLine 3';
		const decsNew = computeDiffDecorations(doc, baseline, true);
		expect(decsNew.size).toBe(1);

		const baselineDoc = Text.of(['Line 1', 'Line 2', 'Line 3']);
		const newVersion = 'Line 1\nLine 2 modified\nLine 3';
		const decsBaseline = computeDiffDecorations(baselineDoc, newVersion, false);
		expect(decsBaseline.size).toBe(1);
	});
});

describe('REV-004: Agent Git Commit Guardrail', () => {
	const engineSrc = readFileSync(resolve(__dirname, '../src/lib/agent/engine.svelte.ts'), 'utf-8');
	const authorSkillSrc = readFileSync(
		resolve(__dirname, '../third_party/specnovelist/.agents/skills/novel-author/SKILL.md'),
		'utf-8'
	);

	// @spec REV-004
	it('hard-blocks agent execution of specnovel accept and git commit', () => {
		expect(engineSrc).toContain("sub === 'accept' || rawArgs.includes('accept')");
		expect(engineSrc).toContain('specnovel accept blocked');
		expect(engineSrc).toContain('Agents cannot commit changes');
	});

	// @spec REV-004
	it('instructs agent in system directives to leave changes unstaged for UI accept controls', () => {
		expect(engineSrc).toContain('STRICT GUARDRAIL (@spec REV-004)');
		expect(engineSrc).toContain('DO NOT run "specnovel accept"');
	});

	// @spec REV-004
	it('updates novel-author skill instructions to disallow specnovel accept and git commit', () => {
		expect(authorSkillSrc).toContain('Do NOT run `specnovel accept` or `git commit`');
		expect(authorSkillSrc).toContain('Leave all new and modified entries unstaged in Git');
	});

	// @spec REV-004
	it('prohibits accept subcommand in specnovel tool definition', () => {
		const specnovelTool = AGENT_TOOLS.find((t) => t.name === 'specnovel');
		expect(specnovelTool).toBeDefined();
		expect(specnovelTool?.description).toContain('prohibited for agents');
	});
});
