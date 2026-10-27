// @spec JRN-001, JRN-002, JRN-003, JRN-004, JRN-005
import { describe, it, expect } from 'vitest';
import { PIPELINE, resolveStageExecution } from '../src/lib/stages';
import {
	getStageStepInfo,
	getStagePillInfo,
	getStageActionInfo,
	getStageUnstagedFiles,
	hasStageGeneratedContent,
	getStageAcceptInfo,
	getStageUpstreamPrefixes,
	getStageDriftDetails
} from '../src/lib/stagesHover';
import type { StatusJson } from '../src/lib/types';
import { project } from '../src/lib/stores/project.svelte';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function createMockStatus(patch: Partial<StatusJson> = {}): StatusJson {
	return {
		title: 'Test Novel',
		baselines: {
			initial: { sha: 'abc1234', date: '2026-10-25T10:00:00Z', subject: 'init' },
			setup: { sha: 'abc1234' },
			research: { sha: 'abc1234' },
			world: { sha: 'abc1234' },
			narrative: { sha: 'abc1234' },
			structure: { sha: 'abc1234' },
			abridged: { sha: 'abc1234' },
			manuscript: { sha: 'abc1234' },
			publishable: { sha: 'abc1234' }
		},
		generatedStages: {
			initial: true,
			setup: true,
			research: true,
			world: true,
			narrative: true,
			structure: true,
			abridged: true,
			manuscript: true,
			publishable: true
		},
		catalog: { RQ: 0, FCT: 10, CHR: 5, BET: 12, ILL: 3, DIR: 2 },
		beats: 12,
		scenes: { structure: 12, outline: 12, abridged: 12, manuscript: 12 },
		words: { abridged: 5000, manuscript: 25000 },
		pending: { abridged: 0, manuscript: 0 },
		illustrations: { active: 3, pending: 0, inactive: 0 },
		graphics: { active: 3, pending: 0, inactive: 0 },
		directives: 2,
		placeholders: { total: 0, untracked: 0 },
		drift: {
			initial: [],
			setup: [],
			research: [],
			world: [],
			narrative: [],
			structure: [],
			abridged: [],
			manuscript: [],
			publishable: []
		},
		upstream_drift: {
			setup: [],
			research: [],
			world: [],
			narrative: [],
			structure: [],
			abridged: [],
			manuscript: [],
			publishable: []
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
		const initialStage = PIPELINE.find((s) => s.id === 'initial')!;
		const stepInfo = getStageStepInfo(initialStage, 0);

		expect(stepInfo.title).toBe('Initial');
		expect(stepInfo.sequenceLabel).toBe('Stage 1 of 9');
		expect(stepInfo.skill).toBe('novel-generate');
		expect(stepInfo.paths).toContain('initial/synopsis.md');
		expect(stepInfo.methodology).toContain('synopsis');

		// Once generated, step skill reflects novel-sync
		const status = createMockStatus();
		const syncedStepInfo = getStageStepInfo(initialStage, 0, status);
		expect(syncedStepInfo.skill).toBe('novel-sync');
	});

	// @spec JRN-001
	it('formats pill hover info for synced status with last accepted date without git terminology', () => {
		const status = createMockStatus();
		const structureStage = PIPELINE.find((s) => s.id === 'structure')!;
		const pillInfo = getStagePillInfo(structureStage, status, 'synced', 'synced');

		expect(pillInfo.title).toBe('Structure Up to Date');
		expect(pillInfo.status).toBe('synced');
		expect(pillInfo.description).not.toMatch(/git|commit|sha|baseline/i);
	});

	// @spec JRN-001
	it('formats pill hover info for needs-sync status with enumerated drift items', () => {
		const status = createMockStatus({
			drift: {
				structure: ['world/characters/CHR-001.md', 'setup/style.md']
			}
		});
		const structureStage = PIPELINE.find((s) => s.id === 'structure')!;
		const pillInfo = getStagePillInfo(structureStage, status, '2 drift', 'needs-sync');

		expect(pillInfo.title).toContain('Upstream Changes Detected');
		expect(pillInfo.items).toContain('world/characters/CHR-001.md');
		expect(pillInfo.items).toContain('setup/style.md');
		expect(pillInfo.description).not.toMatch(/git|commit|sha|baseline/i);
	});

	// @spec JRN-001
	it('lists upstream items that have changed since last sync for structure drift pill', () => {
		const status = createMockStatus({
			upstream_drift: {
				structure: [
					{ change: 'M', file: 'world/characters/CHR-001.md' } as any,
					{ change: 'A', file: 'narrative/beats.md' } as any
				]
			},
			drift: {
				structure: [{ change: 'M', file: 'structure/outline.md' } as any]
			}
		});
		const structureStage = PIPELINE.find((s) => s.id === 'structure')!;
		const pillInfo = getStagePillInfo(structureStage, status, '3 drift', 'needs-sync');

		expect(pillInfo.title).toBe('Upstream Changes Detected');
		expect(pillInfo.items).toContain('world/characters/CHR-001.md');
		expect(pillInfo.items).toContain('narrative/beats.md');
		expect(pillInfo.items).not.toContain('structure/outline.md');
		expect(pillInfo.description).toContain('2 upstream item(s)');

		const actionInfo = getStageActionInfo(structureStage, status);
		expect(actionInfo.items).toContain('world/characters/CHR-001.md');
		expect(actionInfo.items).toContain('narrative/beats.md');
	});

	// @spec JRN-001, JRN-006
	it('incorporates upstream unstaged working-tree files in drift hovercard upstream items', () => {
		const status = createMockStatus({
			upstream_drift: {
				narrative: ['world/places/PLC-001.md']
			}
		});
		const narrativeStage = PIPELINE.find((s) => s.id === 'narrative')!;
		const unstaged = new Set(['world/characters/CHR-002.md', 'directives/style.md', 'narrative/arcs.md']);
		const pillInfo = getStagePillInfo(narrativeStage, status, '3 drift', 'needs-sync', unstaged);

		expect(pillInfo.title).toBe('Upstream Changes Detected');
		// Upstream items changed since last sync
		expect(pillInfo.items).toContain('world/places/PLC-001.md');
		expect(pillInfo.items).toContain('world/characters/CHR-002.md');
		expect(pillInfo.items).toContain('directives/style.md');
		// Stage-local file narrative/arcs.md must NOT be in upstream items
		expect(pillInfo.items).not.toContain('narrative/arcs.md');
		expect(pillInfo.description).toContain('3 upstream item(s)');
	});

	// @spec JRN-001, JRN-006
	it('filters out stage-local files that appear in upstream_drift from specnovel', () => {
		const status = createMockStatus({
			upstream_drift: {
				setup: ['initial/synopsis.md', 'setup/brief.md']
			},
			drift: {
				setup: ['setup/themes.md']
			}
		});
		const setupStage = PIPELINE.find((s) => s.id === 'setup')!;
		const pillInfo = getStagePillInfo(setupStage, status, '1 drift', 'needs-sync');

		expect(pillInfo.title).toBe('Upstream Changes Detected');
		expect(pillInfo.items).toContain('initial/synopsis.md');
		// setup/brief.md belongs to setup itself, so it must not be listed as an upstream change
		expect(pillInfo.items).not.toContain('setup/brief.md');
		expect(pillInfo.items).not.toContain('setup/themes.md');
		expect(pillInfo.description).toContain('1 upstream item(s)');
	});

	// @spec JRN-001
	it('computes upstream folder prefixes correctly across pipeline stages', () => {
		const initialStage = PIPELINE.find((s) => s.id === 'initial')!;
		const setupStage = PIPELINE.find((s) => s.id === 'setup')!;
		const worldStage = PIPELINE.find((s) => s.id === 'world')!;

		expect(getStageUpstreamPrefixes(initialStage)).toEqual(['directives/']);
		expect(getStageUpstreamPrefixes(setupStage)).toContain('initial/');
		expect(getStageUpstreamPrefixes(setupStage)).toContain('directives/');
		expect(getStageUpstreamPrefixes(worldStage)).toContain('initial/');
		expect(getStageUpstreamPrefixes(worldStage)).toContain('setup/');
		expect(getStageUpstreamPrefixes(worldStage)).toContain('research/');
		expect(getStageUpstreamPrefixes(worldStage)).not.toContain('world/');
	});

	// @spec JRN-001
	it('distinguishes internal stage changes when no upstream items have drifted', () => {
		const status = createMockStatus({
			upstream_drift: {
				structure: []
			},
			drift: {
				structure: ['structure/outline.md']
			}
		});
		const structureStage = PIPELINE.find((s) => s.id === 'structure')!;
		const pillInfo = getStagePillInfo(structureStage, status, '1 drift', 'needs-sync');

		expect(pillInfo.title).toBe('Structure Changes Detected');
		expect(pillInfo.items).toEqual(['structure/outline.md']);
		expect(pillInfo.description).toContain('Structure since last sync');
	});

	// @spec JRN-001
	it('correctly handles object-shaped drift items from specnovel without git flags or [object Object]', () => {
		const status = createMockStatus({
			drift: {
				initial: [
					{ change: 'M', file: 'initial/synopsis.md' } as any,
					{ change: 'A', file: 'initial/config.md' } as any
				]
			}
		});
		const initialStage = PIPELINE.find((s) => s.id === 'initial')!;
		const pillInfo = getStagePillInfo(initialStage, status, '2 drift', 'needs-sync');

		// Strips Git diff porcelain flags (e.g. "M ", "A ")
		expect(pillInfo.items).toContain('initial/synopsis.md');
		expect(pillInfo.items).toContain('initial/config.md');
		expect(pillInfo.items).not.toContain('M initial/synopsis.md');
		expect(pillInfo.items.every((it) => typeof it === 'string' && !it.includes('[object Object]'))).toBe(true);

		const actionInfo = getStageActionInfo(initialStage, status);
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

		const worldStage = PIPELINE.find((s) => s.id === 'world')!;
		const worldAction = getStageActionInfo(worldStage, status);
		expect(worldAction.isActionable).toBe(false);
		expect(worldAction.disabledReason).toContain('0 open research questions');

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
		// World stage with open RQs
		const worldStatus = createMockStatus({ catalog: { RQ: 4, FCT: 2 } });
		const worldStage = PIPELINE.find((s) => s.id === 'world')!;
		const worldAction = getStageActionInfo(worldStage, worldStatus);
		expect(worldAction.isActionable).toBe(true);
		expect(worldAction.description).toContain('4 open research question(s)');

		// Manuscript stage with pending scenes
		const manuscriptStatus = createMockStatus({ pending: { abridged: 0, manuscript: 5 } });
		const manuscriptStage = PIPELINE.find((s) => s.id === 'manuscript')!;
		const manuscriptAction = getStageActionInfo(manuscriptStage, manuscriptStatus);
		expect(manuscriptAction.isActionable).toBe(true);
		expect(manuscriptAction.description).toContain('5 scene(s)');

		// Publishable stage with pending illustrations
		const pubStatus = createMockStatus({
			illustrations: { active: 2, pending: 2, inactive: 0 },
			graphics: { active: 2, pending: 2, inactive: 0 }
		});
		const pubStage = PIPELINE.find((s) => s.id === 'publishable')!;
		const pubAction = getStageActionInfo(pubStage, pubStatus);
		expect(pubAction.isActionable).toBe(true);
		expect(pubAction.description).toContain('2 active graphic/illustration asset(s)');
	});

	// @spec JRN-002
	it('selects novel-generate before initial baseline and novel-sync after baseline', () => {
		const setupStage = PIPELINE.find((s) => s.id === 'setup')!;
		const ungeneratedStatus = createMockStatus({
			baselines: { setup: null },
			generatedStages: { setup: false }
		});
		expect(resolveStageExecution(setupStage, ungeneratedStatus).skill).toBe('novel-generate');

		const generatedStatus = createMockStatus();
		expect(resolveStageExecution(setupStage, generatedStatus).skill).toBe('novel-sync');
	});

	// @spec JRN-002
	it('disables publishable stage when 0 manuscript scenes and 0 pending illustrations exist', () => {
		const noProseStatus = createMockStatus({
			scenes: { structure: 10, outline: 10, abridged: 10, manuscript: 0 },
			illustrations: { active: 0, pending: 0, inactive: 0 },
			graphics: { active: 0, pending: 0, inactive: 0 }
		});
		const pubStage = PIPELINE.find((s) => s.id === 'publishable')!;
		const pubAction = getStageActionInfo(pubStage, noProseStatus);
		expect(pubAction.isActionable).toBe(false);
		expect(pubAction.disabledReason).toContain('0 rendered scenes');
	});

	// @spec JRN-001, JRN-002, JRN-003, JRN-004, JRN-005
	it('uses craft action titles and does not expose raw skill names in play button hover cards', () => {
		const status = createMockStatus({
			pending: { abridged: 2, manuscript: 3 },
			illustrations: { active: 1, pending: 1, inactive: 0 },
			graphics: { active: 1, pending: 1, inactive: 0 },
			catalog: { RQ: 1, FCT: 2, CHR: 2 }
		});

		for (const stage of PIPELINE) {
			const action = getStageActionInfo(stage, status);
			expect(action.title).not.toMatch(/^Run novel-/);
			expect(action.title).not.toContain('novel-generate');
			expect(action.title).not.toContain('novel-sync');
			expect(action.description).not.toContain('novel-generate');
			expect(action.description).not.toContain('novel-sync');
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

describe('JRN-003: Journey Rail Stage Acceptance Action', () => {
	const railSource = readFileSync(resolve(__dirname, '../src/lib/components/JourneyRail.svelte'), 'utf-8');

	// @spec JRN-003
	it('provides an accept pill button on stages that need sync / have drift', () => {
		expect(railSource).toContain('accept-btn');
		expect(railSource).toContain('acceptStage');
		expect(railSource).toContain('project.acceptStage');
		expect(railSource).toContain('st.canAccept');
	});

	// @spec JRN-003
	it('only enables canAccept for stages with uncommitted diffs', () => {
		expect(railSource).toContain('const hasUncommittedDiffs = stageUnstaged.length > 0;');
		expect(railSource).toContain('canAccept: hasUncommittedDiffs');
	});

	// @spec JRN-003
	it('matches unstaged working tree files to pipeline stages', () => {
		const initialStage = PIPELINE.find((s) => s.id === 'initial')!;
		const unstaged = new Set(['initial/synopsis.md', 'initial/config.md', 'world/characters/CHR-001.md']);
		const matches = getStageUnstagedFiles(initialStage, unstaged);
		expect(matches).toEqual(['initial/synopsis.md', 'initial/config.md']);
	});

	// @spec JRN-003
	it('strictly ignores directory entries and .gitkeep from triggering stage acceptance', () => {
		const setupStage = PIPELINE.find((s) => s.id === 'setup')!;
		const worldStage = PIPELINE.find((s) => s.id === 'world')!;
		const directoryOnlyUnstaged = new Set([
			'setup/',
			'world/',
			'world/characters/.gitkeep',
			'manuscript/.gitkeep'
		]);
		expect(getStageUnstagedFiles(setupStage, directoryOnlyUnstaged)).toEqual([]);
		expect(getStageUnstagedFiles(worldStage, directoryOnlyUnstaged)).toEqual([]);
	});

	// @spec JRN-003
	it('detects generated content for unbaselined stages ready to accept', () => {
		const initialStage = PIPELINE.find((s) => s.id === 'initial')!;
		const freshStatus = createMockStatus({
			baselines: {
				initial: null,
				setup: null,
				research: null,
				world: null,
				narrative: null,
				structure: null,
				abridged: null,
				manuscript: null,
				publishable: null
			},
			generatedStages: {
				initial: false,
				setup: false,
				research: false,
				world: false,
				narrative: false,
				structure: false,
				abridged: false,
				manuscript: false,
				publishable: false
			}
		});

		// Before synopsis exists
		expect(hasStageGeneratedContent(initialStage, freshStatus, [])).toBe(false);

		// After agent or user populates synopsis file
		expect(hasStageGeneratedContent(initialStage, freshStatus, [{ path: 'initial/synopsis.md' }])).toBe(true);
	});

	// @spec JRN-003
	it('acceptStage falls back to --force on check failure and dismisses stage unstaged files', async () => {
		const projectSrc = readFileSync(resolve(__dirname, '../src/lib/stores/project.svelte.ts'), 'utf-8');
		expect(projectSrc).toContain("[...args, '--force']");
		expect(projectSrc).toContain('res.stderr?.includes');
		expect(projectSrc).toContain('this.unstagedFiles = new Set');
		expect(railSource).toContain('if (!res.success)');
		expect(railSource).toContain('alert(');
	});

	// @spec JRN-003
	it('provides hovercard info and interactions for the accept pill listing uncommitted files', () => {
		const setupStage = PIPELINE.find((s) => s.id === 'setup')!;
		const unstaged = new Set(['setup/brief.md', 'setup/themes.md', 'world/characters/CHR-001.md']);
		const acceptInfo = getStageAcceptInfo(setupStage, unstaged);

		expect(acceptInfo.title).toBe('Accept Changes: Setup');
		expect(acceptInfo.description).toContain('2 files with uncommitted changes');
		expect(acceptInfo.files).toEqual(['setup/brief.md', 'setup/themes.md']);

		// Verify JourneyRail wires hovercard onto accept-btn
		expect(railSource).toContain("showHover('accept', stage, i, st, e.currentTarget)");
		expect(railSource).toContain('unstagedFiles={project.unstagedFiles}');

		// Verify JourneyHoverCard renders accept card
		const hoverCardSrc = readFileSync(resolve(__dirname, '../src/lib/components/JourneyHoverCard.svelte'), 'utf-8');
		expect(hoverCardSrc).toContain("type === 'accept'");
		expect(hoverCardSrc).toContain('acceptInfo.title');
		expect(hoverCardSrc).toContain('acceptInfo.files');
	});
});

describe('JRN-004: Current Stage Tracking and Highlighting', () => {
	const journeyRailSrc = readFileSync(resolve(__dirname, '../src/lib/components/JourneyRail.svelte'), 'utf-8');

	// @spec JRN-004
	it('manages currentStage in project store and allows setting it', () => {
		expect(project.currentStage).toBeDefined();
		project.setCurrentStage('world');
		expect(project.currentStage).toBe('world');
		project.setCurrentStage('initial');
		expect(project.currentStage).toBe('initial');
	});

	// @spec JRN-004
	it('renders current stage styling in JourneyRail.svelte and attaches click handlers to stage nodes and children', () => {
		expect(journeyRailSrc).toContain('class:current={project.currentStage === stage.id}');
		expect(journeyRailSrc).toContain('.stage-node.current');
		expect(journeyRailSrc).toContain('project.setCurrentStage(stage.id)');
		// Same radial gradient as non-current stages rendered over lighter background (#ffffff)
		expect(journeyRailSrc).toContain('radial-gradient');
		expect(journeyRailSrc).toContain('ellipse at center');
		expect(journeyRailSrc).toContain('.stage-node.current');
		expect(journeyRailSrc).toContain('#ffffff');
		expect(journeyRailSrc).toContain('rgba(110, 75, 45, 0.18) 100%');
		// Inset border shadow removed from current stage
		expect(journeyRailSrc).not.toContain('box-shadow: inset 0 0 0 2px var(--accent)');
		// Non-current stages render over var(--paper)
		expect(journeyRailSrc).toContain('.stage-node:not(.current)');
		expect(journeyRailSrc).toContain('var(--paper)');
	});
});

describe('JRN-005: Initial Stage Pending Lifecycle', () => {
	const journeyRailSrc = readFileSync(resolve(__dirname, '../src/lib/components/JourneyRail.svelte'), 'utf-8');

	// @spec JRN-005
	it('treats ungenerated stages as not generated until marked or baselined', () => {
		project.status = createMockStatus({
			baselines: {
				initial: null,
				setup: null,
				research: null,
				world: null,
				narrative: null,
				structure: null,
				abridged: null,
				manuscript: null,
				publishable: null
			},
			generatedStages: {
				initial: false,
				setup: false,
				research: false,
				world: false,
				narrative: false,
				structure: false,
				abridged: false,
				manuscript: false,
				publishable: false
			},
			catalog: { RQ: 0, FCT: 0, CHR: 0, BET: 0, ILL: 0, DIR: 0 },
			beats: 0,
			scenes: { structure: 0, outline: 0, abridged: 0, manuscript: 0 },
			words: { abridged: 0, manuscript: 0 },
			illustrations: { active: 0, pending: 0, inactive: 0 },
			graphics: { active: 0, pending: 0, inactive: 0 }
		});
		project.generatedStages = new Set();

		// Initially all ungenerated stages report false
		for (const stage of PIPELINE) {
			expect(project.isStageGenerated(stage.id)).toBe(false);
		}

		// Marking initial as generated transitions initial only
		project.markStageGenerated('initial');
		expect(project.isStageGenerated('initial')).toBe(true);
		expect(project.isStageGenerated('setup')).toBe(false);
		expect(project.isStageGenerated('world')).toBe(false);
	});

	// @spec JRN-005
	it('ensures JourneyRail enforces pending status until stages are generated', () => {
		expect(journeyRailSrc).toContain('project.isStageGenerated(stage.id)');
		expect(journeyRailSrc).toContain("return { status: 'pending', badge: '', canAccept: false };");
		expect(journeyRailSrc).toContain("badge: effectiveDrift > 0 ? `${effectiveDrift} drift` : 'unaccepted'");
	});

	// @spec JRN-005
	it('shows no accept pills across the rail for a newly created project in its initial committed state', () => {
		project.status = createMockStatus({
			baselines: {
				initial: { short: 'abc1234', subject: 'Initial novel scaffolding' } as any,
				setup: null,
				research: null,
				world: null,
				narrative: null,
				structure: null,
				abridged: null,
				manuscript: null,
				publishable: null
			},
			generatedStages: {
				initial: true,
				setup: false,
				research: false,
				world: false,
				narrative: false,
				structure: false,
				abridged: false,
				manuscript: false,
				publishable: false
			}
		});
		project.unstagedFiles = new Set();
		project.generatedStages = new Set(['initial']);

		for (const stage of PIPELINE) {
			const stageUnstaged = getStageUnstagedFiles(stage, project.unstagedFiles);
			expect(stageUnstaged.length).toBe(0);
		}
	});
});

describe('JRN-006: Interactive Drift Pill Synchronization Action', () => {
	const railSource = readFileSync(resolve(__dirname, '../src/lib/components/JourneyRail.svelte'), 'utf-8');
	const hoverCardSource = readFileSync(resolve(__dirname, '../src/lib/components/JourneyHoverCard.svelte'), 'utf-8');

	// @spec JRN-006
	it('renders drift pills as interactive buttons that trigger stage synchronization without native tooltip attributes', () => {
		expect(railSource).toContain("st.badge.includes('drift')");
		expect(railSource).toContain('drift-btn');
		expect(railSource).toContain('syncStage(stage)');
		expect(railSource).toContain("disabled={agent.status === 'running'}");
		// Native browser title attribute omitted to prevent collision with custom hover card
		expect(railSource).not.toMatch(/<button[^>]*class="[^"]*drift-btn[^"]*"[^>]*title=/);
	});

	// @spec JRN-006
	it('integrates synchronization action guidance directly into the hover card below the title', () => {
		expect(hoverCardSource).toContain('action-hint');
		expect(hoverCardSource).toContain('pillInfo.actionHint');
		// Action hint appears directly following card-title in the pill hover section
		const titleIdx = hoverCardSource.indexOf('<h4 class="card-title">{pillInfo.title}</h4>');
		const hintIdx = hoverCardSource.indexOf('class="action-hint"');
		const descIdx = hoverCardSource.indexOf('<p class="card-desc">{pillInfo.description}</p>');
		expect(titleIdx).toBeGreaterThan(-1);
		expect(hintIdx).toBeGreaterThan(titleIdx);
		expect(descIdx).toBeGreaterThan(hintIdx);

		const setupStage = PIPELINE.find((s) => s.id === 'setup')!;
		const driftStatus = createMockStatus({
			drift: { setup: ['brief.md'] },
			upstream_drift: { setup: [] }
		});
		const pillInfo = getStagePillInfo(setupStage, driftStatus, '1 drift', 'needs-sync');
		expect(pillInfo.actionHint).toBeDefined();
		expect(pillInfo.actionHint).toContain('synchronize');
	});

	// @spec JRN-006
	it('provides styling for interactive drift pill buttons with distinct hover and disabled states', () => {
		expect(railSource).toContain('button.pill.drift-btn');
		expect(railSource).toContain('button.pill.drift-btn:hover:not(:disabled)');
		expect(railSource).toContain('button.pill.drift-btn:disabled');
	});
});



