// @spec JRN-001, JRN-002
import { describe, it, expect } from 'vitest';
import { PIPELINE } from '../src/lib/stages';
import {
	getStageStepInfo,
	getStagePillInfo,
	getStageActionInfo
} from '../src/lib/stagesHover';
import type { StatusJson } from '../src/lib/types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function createMockStatus(patch: Partial<StatusJson> = {}): StatusJson {
	return {
		title: 'Test Novel',
		baselines: {
			brief: { sha: 'abc1234', date: '2026-10-25T10:00:00Z', subject: 'init' },
			research: { sha: 'abc1234' },
			outline: { sha: 'abc1234' },
			graphics: { sha: 'abc1234' },
			abridged: { sha: 'abc1234' },
			manuscript: { sha: 'abc1234' }
		},
		catalog: { RQ: 0, FCT: 10, CHR: 5 },
		scenes: { outline: 12, abridged: 12, manuscript: 12 },
		words: { abridged: 5000, manuscript: 25000 },
		pending: { abridged: 0, manuscript: 0 },
		graphics: { active: 3, pending: 0, inactive: 0 },
		placeholders: { total: 0, untracked: 0 },
		drift: {
			brief: [],
			research: [],
			outline: [],
			graphics: [],
			abridged: [],
			manuscript: []
		},
		errors: [],
		warnings: [],
		infos: [],
		next: '',
		...patch
	};
}

describe('JRN-001: Contextual Hover Cards for Journey Rail Elements (Issue #7)', () => {
	// @spec JRN-001
	it('provides comprehensive step information and methodology for each pipeline stage', () => {
		const briefStage = PIPELINE.find((s) => s.id === 'brief')!;
		const stepInfo = getStageStepInfo(briefStage, 0);

		expect(stepInfo.title).toBe('Brief');
		expect(stepInfo.sequenceLabel).toBe('Stage 1 of 7');
		expect(stepInfo.skill).toBe('novel-init');
		expect(stepInfo.paths).toContain('story/synopsis.md');
		expect(stepInfo.methodology).toContain('synopsis');
	});

	// @spec JRN-001
	it('formats pill hover info for synced status with last accepted date without git terminology', () => {
		const status = createMockStatus();
		const outlineStage = PIPELINE.find((s) => s.id === 'outline')!;
		const pillInfo = getStagePillInfo(outlineStage, status, 'synced', 'synced');

		expect(pillInfo.title).toBe('Outline Up to Date');
		expect(pillInfo.status).toBe('synced');
		expect(pillInfo.description).not.toMatch(/git|commit|sha|baseline/i);
	});

	// @spec JRN-001
	it('formats pill hover info for needs-sync status with enumerated drift items', () => {
		const status = createMockStatus({
			drift: {
				outline: ['kb/characters/CHR-001.md', 'story/style.md']
			}
		});
		const outlineStage = PIPELINE.find((s) => s.id === 'outline')!;
		const pillInfo = getStagePillInfo(outlineStage, status, '2 drift', 'needs-sync');

		expect(pillInfo.title).toContain('Upstream Changes Detected');
		expect(pillInfo.items).toContain('kb/characters/CHR-001.md');
		expect(pillInfo.items).toContain('story/style.md');
		expect(pillInfo.description).not.toMatch(/git|commit|sha|baseline/i);
	});

	// @spec JRN-001
	it('correctly handles object-shaped drift items from specnovel without git flags or [object Object]', () => {
		const status = createMockStatus({
			drift: {
				outline: [
					{ change: 'M', file: 'outline/outline.md' } as any,
					{ change: 'A', file: 'kb/places/PLC-001.md' } as any
				]
			}
		});
		const outlineStage = PIPELINE.find((s) => s.id === 'outline')!;
		const pillInfo = getStagePillInfo(outlineStage, status, '2 drift', 'needs-sync');

		// Strips Git diff porcelain flags (e.g. "M ", "A ")
		expect(pillInfo.items).toContain('outline/outline.md');
		expect(pillInfo.items).toContain('kb/places/PLC-001.md');
		expect(pillInfo.items).not.toContain('M outline/outline.md');
		expect(pillInfo.items.every((it) => typeof it === 'string' && !it.includes('[object Object]'))).toBe(true);

		const actionInfo = getStageActionInfo(outlineStage, status);
		expect(actionInfo.items).toContain('outline/outline.md');
		expect(actionInfo.items.every((it) => typeof it === 'string' && !it.includes('[object Object]'))).toBe(true);
	});

	// @spec JRN-001
	it('uses Affected Items label and omits Git baseline commit terminology in JourneyHoverCard.svelte', () => {
		const cardSource = readFileSync(resolve(__dirname, '../src/lib/components/JourneyHoverCard.svelte'), 'utf-8');

		expect(cardSource).toContain('Affected Items:');
		expect(cardSource).not.toContain('Baseline Commit:');
		expect(cardSource).not.toContain('commit-sha');
		expect(cardSource).not.toContain('HEAD');
	});

	// @spec JRN-001
	it('formats pill hover info for pending artifact generation with enumerated pending items', () => {
		const status = createMockStatus({
			pending: { abridged: 3, manuscript: 0 },
			pending_items: {
				abridged: ['SCN-001', 'SCN-002', 'SCN-003']
			}
		});
		const abridgedStage = PIPELINE.find((s) => s.id === 'abridged')!;
		const pillInfo = getStagePillInfo(abridgedStage, status, '3 pending', 'needs-sync');

		expect(pillInfo.title).toContain('Pending Generation');
		expect(pillInfo.description).toContain('3 item(s)');
		expect(pillInfo.items).toEqual(['SCN-001', 'SCN-002', 'SCN-003']);
	});

	// @spec JRN-001
	it('replaces native browser tooltips with JourneyHoverCard in JourneyRail.svelte', () => {
		const railSource = readFileSync(resolve(__dirname, '../src/lib/components/JourneyRail.svelte'), 'utf-8');

		expect(railSource).toContain('JourneyHoverCard');
		expect(railSource).toContain('showHover');
		expect(railSource).toContain('hideHover');
		// Removed native title attributes on stage-node and run button
		expect(railSource).not.toMatch(/title="\{stage\.label\}/);
		expect(railSource).not.toMatch(/title="Run \{stage\.skill\}"/);
	});
});

describe('JRN-002: Dynamic Stage Action Feasibility and Play Button Disabling (Issue #7)', () => {
	// @spec JRN-002
	it('disables play button and explains reason when stage is up to date', () => {
		const status = createMockStatus(); // fully synced, 0 pending, 0 drift, 0 open RQs

		const researchStage = PIPELINE.find((s) => s.id === 'research')!;
		const researchAction = getStageActionInfo(researchStage, status);
		expect(researchAction.isActionable).toBe(false);
		expect(researchAction.disabledReason).toContain('0 open research questions');

		const abridgedStage = PIPELINE.find((s) => s.id === 'abridged')!;
		const abridgedAction = getStageActionInfo(abridgedStage, status);
		expect(abridgedAction.isActionable).toBe(false);
		expect(abridgedAction.disabledReason).toContain('up to date');

		const manuscriptStage = PIPELINE.find((s) => s.id === 'manuscript')!;
		const manuscriptAction = getStageActionInfo(manuscriptStage, status);
		expect(manuscriptAction.isActionable).toBe(false);
		expect(manuscriptAction.disabledReason).toContain('up to date');
	});

	// @spec JRN-002
	it('enables play button and describes target work when pending items exist', () => {
		// Research stage with open RQs
		const researchStatus = createMockStatus({ catalog: { RQ: 4, FCT: 2 } });
		const researchStage = PIPELINE.find((s) => s.id === 'research')!;
		const researchAction = getStageActionInfo(researchStage, researchStatus);
		expect(researchAction.isActionable).toBe(true);
		expect(researchAction.description).toContain('4 open research question(s)');

		// Manuscript stage with pending scenes
		const manuscriptStatus = createMockStatus({ pending: { abridged: 0, manuscript: 5 } });
		const manuscriptStage = PIPELINE.find((s) => s.id === 'manuscript')!;
		const manuscriptAction = getStageActionInfo(manuscriptStage, manuscriptStatus);
		expect(manuscriptAction.isActionable).toBe(true);
		expect(manuscriptAction.description).toContain('5 scene(s)');

		// Graphics stage with pending graphics
		const gfxStatus = createMockStatus({ graphics: { active: 2, pending: 2, inactive: 0 } });
		const gfxStage = PIPELINE.find((s) => s.id === 'graphics')!;
		const gfxAction = getStageActionInfo(gfxStage, gfxStatus);
		expect(gfxAction.isActionable).toBe(true);
		expect(gfxAction.description).toContain('2 active graphic asset(s)');
	});

	// @spec JRN-002
	it('disables publish stage when 0 manuscript scenes exist', () => {
		const noProseStatus = createMockStatus({ scenes: { outline: 10, abridged: 10, manuscript: 0 } });
		const publishStage = PIPELINE.find((s) => s.id === 'publish')!;
		const publishAction = getStageActionInfo(publishStage, noProseStatus);
		expect(publishAction.isActionable).toBe(false);
		expect(publishAction.disabledReason).toContain('0 rendered scenes');
	});

	// @spec JRN-001, JRN-002
	it('uses craft action titles and does not expose raw skill names in play button hover cards', () => {
		const status = createMockStatus({
			pending: { abridged: 2, manuscript: 3 },
			graphics: { active: 1, pending: 1, inactive: 0 },
			catalog: { RQ: 1, FCT: 2, CHR: 2 }
		});

		for (const stage of PIPELINE) {
			const action = getStageActionInfo(stage, status);
			expect(action.title).not.toMatch(/^Run novel-/);
			expect(action.title).not.toContain(stage.skill);
			expect(action.description).not.toContain(stage.skill);
		}

		const cardSource = readFileSync(resolve(__dirname, '../src/lib/components/JourneyHoverCard.svelte'), 'utf-8');
		// Ensure play section doesn't expose skill-tag
		const playSection = cardSource.split("type === 'play'")[1]?.split('{:else')[0] || '';
		expect(playSection).not.toContain('{stage.skill}');
	});

	// @spec JRN-002
	it('JourneyRail component binds disabled attribute and class on inactive run buttons', () => {
		const railSource = readFileSync(resolve(__dirname, '../src/lib/components/JourneyRail.svelte'), 'utf-8');

		expect(railSource).toContain('class:disabled={!action.isActionable}');
		expect(railSource).toContain('disabled={!action.isActionable');
		expect(railSource).toContain('getStageActionInfo');
	});
});
