// @spec BBL-001, BBL-002, BBL-003, BBL-004, BBL-005, BBL-006
import { describe, it, expect, vi } from 'vitest';
import { parseFile, prefixOf, prefixInfo } from '../src/lib/entities';
import { renderMarkdown, renderWikiChips } from '../src/lib/markdown';
import { project } from '../src/lib/stores/project.svelte';
import { getEntityPreview, clearWikiPreviewCache } from '../src/lib/wikiHover.svelte';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('BBL-001: Story Bible Entity Categorization', () => {
	// @spec BBL-001
	it('identifies entity kinds, IDs, and 9-stage folders correctly', () => {
		expect(prefixOf('CHR-001')).toBe('CHR');
		expect(prefixInfo('CHR-001').label).toBe('Character');
		expect(prefixInfo('CHR-001').folder).toBe('world/characters');
		expect(prefixInfo('PLC-005').label).toBe('Place');
		expect(prefixInfo('PLC-005').folder).toBe('world/places');
		expect(prefixInfo('ORG-012').label).toBe('Organization');
		expect(prefixInfo('OBJ-003').label).toBe('Object');
		expect(prefixInfo('BET-001').label).toBe('Narrative beat');
		expect(prefixInfo('BET-001').file).toBe('narrative/beats.md');
		expect(prefixInfo('ILL-001').label).toBe('Illustration');
		expect(prefixInfo('ILL-001').file).toBe('narrative/illustrations.md');
		expect(prefixInfo('ARC-001').label).toBe('Story arc');
		expect(prefixInfo('DIR-001').label).toBe('Directive');
		expect(prefixInfo('DIR-001').folder).toBe('directives');
		expect(prefixInfo('SCN-001').label).toBe('Scene');
		expect(prefixInfo('SCN-001').file).toBe('structure/outline.md');
	});

	// @spec BBL-001
	it('renders disclosure chevron indicators on collapsible story bible group summaries', () => {
		const explorerSrc = readFileSync(resolve(__dirname, '../src/lib/components/Explorer.svelte'), 'utf-8');
		expect(explorerSrc).toContain('class="group-chevron"');
		expect(explorerSrc).toContain('group-details');
		expect(explorerSrc).toContain('group-details:not([open]) .group-chevron');
		expect(explorerSrc).toContain('transform: rotate(-90deg)');
	});

	// @spec BBL-001
	it('persists and restores collapsed state of story bible sections', () => {
		const explorerSrc = readFileSync(resolve(__dirname, '../src/lib/components/Explorer.svelte'), 'utf-8');
		expect(explorerSrc).toContain('novelstudio.bible_collapsed');
		expect(explorerSrc).toContain('isSectionOpen');
		expect(explorerSrc).toContain('handleSectionToggle');
		expect(explorerSrc).toContain('ontoggle');
	});
});

describe('BBL-002: Bidirectional Wiki-link Extraction', () => {
	// @spec BBL-002
	it('extracts wiki-links with and without display aliases', () => {
		const doc = `
# SCN-001: First Encounter
Alice met [[CHR-002|Bob Vance]] at the [[PLC-001]]. Later she consulted [[ORG-003]].
`;
		const { defs, refs } = parseFile('outline/scenes/SCN-001.md', doc);

		expect(defs).toHaveLength(1);
		expect(defs[0].id).toBe('SCN-001');

		expect(refs).toHaveLength(3);
		expect(refs[0].id).toBe('CHR-002');
		expect(refs[0].alias).toBe('Bob Vance');
		expect(refs[1].id).toBe('PLC-001');
		expect(refs[1].alias).toBeUndefined();
		expect(refs[2].id).toBe('ORG-003');
		expect(refs[2].alias).toBeUndefined();
	});
});

describe('BBL-003: Centralized Wiki-Link Navigation and Target Item Scrolling', () => {
	// @spec BBL-003 (Issue #4)
	it('converts raw wiki-links in agent feed into interactive wiki chips', () => {
		const rawText = 'Agent inspected [[CHR-001|Red]] and recorded [[PLC-005]].';
		const html = renderWikiChips(rawText);
		expect(html).toContain('data-wiki="CHR-001"');
		expect(html).toContain('data-wiki="PLC-005"');
		expect(html).toContain('Red');
		expect(html).toContain('PLC-005');
		expect(html).toContain('wiki-chip');
	});

	// @spec BBL-003 (Issue #4)
	it('generates anchor IDs for entity headings in rendered markdown', () => {
		const md = '# CHR-001: Red Riding Hood\n\nSome character description.';
		const rendered = renderMarkdown(md);
		expect(rendered).toContain('id="CHR-001"');
		expect(rendered).toContain('data-id="CHR-001"');
	});

	// @spec BBL-003 (Issue #4)
	it('navigates via centralized openId and updates targetLine and targetId in project.view', () => {
		project.defs['CHR-001'] = {
			id: 'CHR-001',
			title: 'Red',
			path: 'kb/characters/CHR-001-red.md',
			line: 12
		};

		const success = project.openId('CHR-001');
		expect(success).toBe(true);
		expect(project.view).toEqual({
			kind: 'file',
			path: 'kb/characters/CHR-001-red.md',
			line: 12,
			id: 'CHR-001'
		});

		// Calling for unknown entity returns false
		expect(project.openId('NONEXISTENT-999')).toBe(false);
	});

	// @spec BBL-003
	it('updates project.currentStage to destination stage when openId is called', () => {
		project.defs['CHR-001'] = {
			id: 'CHR-001',
			title: 'Red',
			path: 'world/characters/CHR-001-red.md',
			line: 12,
			level: 1,
			layer: 'plan'
		};
		project.setCurrentStage('setup');
		expect(project.currentStage).toBe('setup');
		project.openId('CHR-001');
		expect(project.currentStage).toBe('world');
	});

	// @spec BBL-003 (Issue #4)
	it('integrates target item scrolling and wikiLinks click delegation in Editor and AgentPanel', () => {
		const editorSource = readFileSync(resolve(__dirname, '../src/lib/components/Editor.svelte'), 'utf-8');
		const panelSource = readFileSync(resolve(__dirname, '../src/lib/components/AgentPanel.svelte'), 'utf-8');
		const workCardSource = readFileSync(resolve(__dirname, '../src/lib/components/WorkCard.svelte'), 'utf-8');

		// Editor implements target item scrolling
		expect(editorSource).toContain('scrollToTarget');
		expect(editorSource).toContain('scrollIntoView');
		expect(editorSource).toContain('highlight-target');

		// AgentPanel and WorkCard delegate wiki links to centralized openId
		expect(panelSource).toContain('use:wikiLinks');
		expect(panelSource).toContain('renderWikiChips');
		expect(workCardSource).toContain('use:wikiLinks');
		expect(workCardSource).toContain('renderWikiChips');
	});
});

describe('BBL-004: Collapsible and Resizable Navigation Pane', () => {
	const explorerSrc = readFileSync(resolve(__dirname, '../src/lib/components/Explorer.svelte'), 'utf-8');

	// @spec BBL-004
	it('implements drag-resizable width with persistence in Explorer.svelte', () => {
		expect(explorerSrc).toContain('class="resize-handle"');
		expect(explorerSrc).toContain('handlePointerDown');
		expect(explorerSrc).toContain('handleDoubleClick');
		expect(explorerSrc).toContain('novelstudio.explorer_width');
		expect(explorerSrc).toContain('MIN_WIDTH');
		expect(explorerSrc).toContain('MAX_WIDTH');
	});

	// @spec BBL-004
	it('implements collapsible navigation pane with toggle controls and collapsed strip', () => {
		expect(explorerSrc).toContain('isCollapsed');
		expect(explorerSrc).toContain('toggleCollapse');
		expect(explorerSrc).toContain('novelstudio.explorer_collapsed');
		expect(explorerSrc).toContain('class="collapse-btn');
		expect(explorerSrc).toContain('class="expand-btn');
		expect(explorerSrc).toContain('class="collapsed-strip"');
	});
});

describe('BBL-005: Stage-Filtered Navigators', () => {
	const explorerSrc = readFileSync(resolve(__dirname, '../src/lib/components/Explorer.svelte'), 'utf-8');

	// @spec BBL-005
	it('filters file list by project.currentStage', () => {
		expect(explorerSrc).toContain('filteredFiles');
		expect(explorerSrc).toContain('stageOfPath');
		expect(explorerSrc).toContain('project.currentStage');
	});

	// @spec BBL-005
	it('filters Story Bible entities by project.currentStage', () => {
		expect(explorerSrc).toContain('filteredPrefixes');
		expect(explorerSrc).toContain('project.currentStage');
	});
});

describe('BBL-006: Wiki-Link Destination Hovercard Preview', () => {
	const hoverCardSrc = readFileSync(resolve(__dirname, '../src/lib/components/WikiHoverCard.svelte'), 'utf-8');
	const layoutSrc = readFileSync(resolve(__dirname, '../src/routes/+layout.svelte'), 'utf-8');
	const editorSrc = readFileSync(resolve(__dirname, '../src/lib/components/Editor.svelte'), 'utf-8');

	// @spec BBL-006
	it('WikiHoverCard renders first 5 lines completely and fades 6th line vertically to transparent', () => {
		expect(hoverCardSrc).toContain('wiki-preview-content');
		expect(hoverCardSrc).toContain('line-height: 20px');
		expect(hoverCardSrc).toContain('max-height: 120px');
		// First 5 lines (100px) fully opaque, 6th line (100-120px) gradient to transparent
		expect(hoverCardSrc).toContain('linear-gradient(to bottom, black 100px, transparent 120px)');
	});

	// @spec BBL-006
	it('attaches global hovercard in +layout.svelte and CodeMirror tooltip in Editor.svelte', () => {
		expect(layoutSrc).toContain('WikiHoverCard');
		expect(layoutSrc).toContain('setupWikiHoverListeners');
		expect(editorSrc).toContain('cmWikiTooltip');
		expect(editorSrc).toContain('hoverTooltip');
	});

	// @spec BBL-006
	it('getEntityPreview extracts and renders destination markdown content', async () => {
		clearWikiPreviewCache();
		project.defs = {
			'CHR-001': {
				id: 'CHR-001',
				title: 'Elena Vance',
				path: 'world/characters/CHR-001.md',
				line: 1,
				level: 1,
				layer: 'plan'
			}
		};
		vi.spyOn(project, 'read').mockResolvedValue(
			'# CHR-001: Elena Vance\n- **Role:** protagonist\n- **Age:** 28\n- **Occupation:** Restorer\n- **Notes:** Secret agent\n- **Extra:** Line six content here\n- **More:** Extra line seven\n'
		);

		const preview = await getEntityPreview('CHR-001');
		expect(preview.id).toBe('CHR-001');
		expect(preview.title).toBe('Elena Vance');
		expect(preview.path).toBe('world/characters/CHR-001.md');
		expect(preview.renderedHtml).toContain('Elena Vance');
		expect(preview.renderedHtml).toContain('protagonist');
	});

	// @spec BBL-006
	it('getEntityPreview handles uncataloged or missing entities gracefully', async () => {
		clearWikiPreviewCache();
		project.defs = {};
		const missingPreview = await getEntityPreview('CHR-999');
		expect(missingPreview.id).toBe('CHR-999');
		expect(missingPreview.isDefined).toBe(false);
		expect(missingPreview.renderedHtml).toContain('No definition found');
	});
});


