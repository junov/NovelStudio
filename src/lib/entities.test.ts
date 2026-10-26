import { describe, it, expect } from 'vitest';
import { parseFile, stripWiki, prefixInfo, prefixOf, preferDefinition } from './entities';
import { PIPELINE, stageForSkill } from './stages';

describe('Entity Parsing & Wiki Links', () => {
	it('extracts ID headings and wiki references', () => {
		const doc = `
# CHR-001: Elena Voss
- **Role:** Physician
- **Allies:** [[CHR-002|Karl]], [[ORG-001]]

## Background
She arrived at [[PLC-005]].
<!-- [[CHR-999]] commented out -->
`;
		const { defs, refs } = parseFile('kb/characters/CHR-001.md', doc);

		expect(defs).toHaveLength(1);
		expect(defs[0].id).toBe('CHR-001');
		expect(defs[0].title).toBe('Elena Voss');
		expect(defs[0].layer).toBe('plan');

		expect(refs).toHaveLength(3);
		expect(refs[0].id).toBe('CHR-002');
		expect(refs[0].alias).toBe('Karl');
		expect(refs[1].id).toBe('ORG-001');
		expect(refs[2].id).toBe('PLC-005');
	});

	it('strips wiki syntax correctly', () => {
		const text = 'Elena meets [[CHR-002|Karl]] at [[PLC-001]].';
		expect(stripWiki(text)).toBe('Elena meets Karl at PLC-001.');
	});

	it('correctly maps entity prefixes', () => {
		expect(prefixOf('CHR-014')).toBe('CHR');
		expect(prefixInfo('CHR-014').label).toBe('Character');
		expect(prefixInfo('PLC-002').folder).toBe('world/places');
		expect(prefixInfo('BET-003').label).toBe('Narrative beat');
		expect(prefixInfo('DIR-001').folder).toBe('directives');
		expect(prefixInfo('SCN-001').plural).toBe('Scenes');
	});

	it('prioritizes plan layer definitions over derived drafts', () => {
		const planDef = { id: 'SCN-001', title: 'The Start', path: 'structure/outline.md', line: 10, level: 3, layer: 'plan' as const };
		const draftDef = { id: 'SCN-001', title: 'The Start (Draft)', path: 'abridged/CHP-001.md', line: 1, level: 3, layer: 'abridged' as const };

		expect(preferDefinition(planDef, draftDef)).toBe(planDef);
		expect(preferDefinition(undefined, draftDef)).toBe(draftDef);
	});
});

describe('Pipeline Stages', () => {
	// @spec AGT-008
	it('has 9 core pipeline stages in sequence without story bible', () => {
		expect(PIPELINE.map((s) => s.id)).toEqual([
			'initial',
			'setup',
			'research',
			'world',
			'narrative',
			'structure',
			'abridged',
			'manuscript',
			'publishable'
		]);
	});

	it('maps skills to stages', () => {
		expect(stageForSkill('novel-generate')).toBe('initial');
		expect(stageForSkill('novel-feedback')).toBe('setup');
		expect(stageForSkill('novel-sync')).toBe('structure');
		expect(stageForSkill('novel-verify')).toBe('manuscript');
		expect(stageForSkill('novel-analyze')).toBe('publishable');
	});
});
