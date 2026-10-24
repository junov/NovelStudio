// @spec BBL-001, BBL-002
import { describe, it, expect } from 'vitest';
import { parseFile, prefixOf, prefixInfo } from '../src/lib/entities';

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
