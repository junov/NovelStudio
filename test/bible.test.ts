// @spec BBL-001, BBL-002, BBL-003
import { describe, it, expect } from 'vitest';
import { parseFile, prefixOf, prefixInfo } from '../src/lib/entities';
import { renderMarkdown, renderWikiChips } from '../src/lib/markdown';
import { project } from '../src/lib/stores/project.svelte';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('BBL-001: Story Bible Entity Categorization', () => {
	// @spec BBL-001
	it('identifies entity kinds and IDs correctly', () => {
		expect(prefixOf('CHR-001')).toBe('CHR');
		expect(prefixInfo('CHR-001').label).toBe('Character');
		expect(prefixInfo('PLC-005').label).toBe('Place');
		expect(prefixInfo('ORG-012').label).toBe('Organization');
		expect(prefixInfo('OBJ-003').label).toBe('Object');
		expect(prefixInfo('SCN-001').label).toBe('Scene');
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
