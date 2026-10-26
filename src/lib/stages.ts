/**
 * The 9-stage SpecNovelist pipeline as presented in the Journey Rail.
 * `sync` is the `Novel-Sync:` stage name used by `specnovel.py accept --stage`.
 * @spec AGT-008, JRN-001, JRN-002
 */
import type { StatusJson } from '$lib/types';

export type SyncStage =
	| 'initial'
	| 'setup'
	| 'research'
	| 'world'
	| 'narrative'
	| 'structure'
	| 'abridged'
	| 'manuscript'
	| 'publishable';

export const SKILLS = [
	'novel-generate',
	'novel-sync',
	'novel-feedback',
	'novel-verify',
	'novel-analyze'
] as const;
export type SkillName = (typeof SKILLS)[number];

export interface PipelineStage {
	id: SyncStage;
	label: string;
	sync: SyncStage;
	/** Primary SpecNovelist skill for initial stage generation. */
	skill: SkillName;
	/** SpecNovelist skill used once the stage has been generated at least once. */
	syncSkill: SkillName;
	/** Other skills offered as secondary actions. */
	extraSkills?: SkillName[];
	description: string;
	/** Files/folders that belong to this stage (for the explorer and "open" actions). */
	paths: string[];
	/** Instruction sent to the agent when generating this stage for the first time. */
	prompt: string;
	/** Instruction sent to the agent when synchronizing this stage from upstream changes. */
	syncPrompt: string;
}

export const PIPELINE: PipelineStage[] = [
	{
		id: 'initial',
		label: 'Initial',
		sync: 'initial',
		skill: 'novel-generate',
		syncSkill: 'novel-sync',
		description: 'Seed synopsis and foundational project configuration (title, author, locales).',
		paths: ['initial/synopsis.md', 'initial/config.md'],
		prompt:
			'Run novel-generate for the initial stage. Review or refine initial/synopsis.md and initial/config.md with the author via ask_user.',
		syncPrompt:
			'Run novel-sync for the initial stage: synchronize initial/synopsis.md and initial/config.md.'
	},
	{
		id: 'setup',
		label: 'Setup',
		sync: 'setup',
		skill: 'novel-generate',
		syncSkill: 'novel-sync',
		description: 'Discovery interview → creative brief, thematic pillars (THM), and prose style guide (STY).',
		paths: ['setup/brief.md', 'setup/themes.md', 'setup/style.md'],
		prompt:
			'Run novel-generate for the setup stage. Conduct the discovery interview via ask_user based on initial/synopsis.md and initial/config.md, and populate setup/brief.md, setup/themes.md, and setup/style.md.',
		syncPrompt:
			'Run novel-sync for the setup stage: incrementally update setup/brief.md, setup/themes.md, and setup/style.md from upstream changes.'
	},
	{
		id: 'research',
		label: 'Research',
		sync: 'research',
		skill: 'novel-generate',
		syncSkill: 'novel-sync',
		description: 'Identify factual, historical, and technical research questions (RQ).',
		paths: ['research/questions.md'],
		prompt:
			'Run novel-generate for the research stage: formulate structured research questions (RQ) in research/questions.md based on initial/ and setup/.',
		syncPrompt:
			'Run novel-sync for the research stage: update research/questions.md from upstream changes in initial/, setup/, and directives/.'
	},
	{
		id: 'world',
		label: 'World',
		sync: 'world',
		skill: 'novel-generate',
		syncSkill: 'novel-sync',
		description: 'Resolve research into cited sources/facts (SRC/FCT) and build the world & character bible.',
		paths: [
			'world/INDEX.md',
			'world/characters',
			'world/places',
			'world/facts',
			'world/sources',
			'world/rules',
			'world/timeline',
			'world/organizations',
			'world/objects',
			'world/glossary'
		],
		prompt:
			'Run novel-generate for the world stage: investigate open research questions into world/sources/ and world/facts/, and generate the world bible entities in world/.',
		syncPrompt:
			'Run novel-sync for the world stage: synchronize world/ entities and resolve any open research questions or upstream changes.'
	},
	{
		id: 'narrative',
		label: 'Narrative',
		sync: 'narrative',
		skill: 'novel-generate',
		syncSkill: 'novel-sync',
		description: 'Design story arcs (ARC), the causal Beat DAG (BET), and illustration specs (ILL).',
		paths: ['narrative/arcs.md', 'narrative/beats.md', 'narrative/illustrations.md'],
		prompt:
			'Run novel-generate for the narrative stage: design story arcs in narrative/arcs.md, build the causal Beat DAG in narrative/beats.md, and specify illustrations in narrative/illustrations.md.',
		syncPrompt:
			'Run novel-sync for the narrative stage: synchronize narrative/arcs.md, narrative/beats.md, and narrative/illustrations.md with upstream changes.'
	},
	{
		id: 'structure',
		label: 'Structure',
		sync: 'structure',
		skill: 'novel-generate',
		syncSkill: 'novel-sync',
		description: 'Sequence narrative beats and illustrations into chapters and scenes (SCN) in reading order.',
		paths: [
			'structure/outline.md',
			'structure/front-matter',
			'structure/back-matter/acknowledgements.md'
		],
		prompt:
			'Run novel-generate for the structure stage: sequence all active narrative beats and illustrations into chapters and scenes in structure/outline.md, and prepare front/back matter.',
		syncPrompt:
			'Run novel-sync for the structure stage: update structure/outline.md and front/back matter to reflect upstream changes.'
	},
	{
		id: 'abridged',
		label: 'Abridged',
		sync: 'abridged',
		skill: 'novel-generate',
		syncSkill: 'novel-sync',
		description: 'Condensed chapter drafts (abridged/CHP-NNN.md) locking in plot and key dialogue.',
		paths: ['abridged'],
		prompt:
			'Run novel-generate for the abridged stage: draft condensed chapter files in abridged/ for all outlined scenes.',
		syncPrompt:
			'Run novel-sync for the abridged stage: draft or update abridged chapters for impacted scenes.'
	},
	{
		id: 'manuscript',
		label: 'Manuscript',
		sync: 'manuscript',
		skill: 'novel-generate',
		syncSkill: 'novel-sync',
		extraSkills: ['novel-verify'],
		description: 'Render full immersive literary prose adhering to setup/style.md and world lore.',
		paths: ['manuscript'],
		prompt:
			'Run novel-generate for the manuscript stage: render full manuscript prose in manuscript/ for all scenes.',
		syncPrompt:
			'Run novel-sync for the manuscript stage: render or update manuscript prose for impacted scenes.'
	},
	{
		id: 'publishable',
		label: 'Publishable',
		sync: 'publishable',
		skill: 'novel-generate',
		syncSkill: 'novel-sync',
		extraSkills: ['novel-verify', 'novel-analyze'],
		description: 'Render illustration assets (ILL) and compile EPUB, PDF, DOCX, and Markdown.',
		paths: ['publishable/graphics', 'publishable'],
		prompt:
			'Run novel-generate for the publishable stage: render active illustration assets in publishable/graphics/ and compile the book deliverables.',
		syncPrompt:
			'Run novel-sync for the publishable stage: update impacted illustration assets and recompile book deliverables.'
	}
];

/**
 * Determines whether a stage has already been generated at least once, and selects
 * `novel-generate` (initial generation) vs `novel-sync` (incremental synchronization).
 * @spec AGT-008, JRN-002
 */
export function isStageGenerated(stage: PipelineStage, status: StatusJson | null): boolean {
	if (!status) return false;
	if (status.generatedStages && stage.id in status.generatedStages) {
		return Boolean(status.generatedStages[stage.id]);
	}
	return Boolean(status.baselines?.[stage.sync]);
}

export function resolveStageExecution(
	stage: PipelineStage,
	status: StatusJson | null
): { skill: SkillName; prompt: string; isGenerated: boolean } {
	const isGenerated = isStageGenerated(stage, status);
	return {
		skill: isGenerated ? stage.syncSkill : stage.skill,
		prompt: isGenerated ? stage.syncPrompt : stage.prompt,
		isGenerated
	};
}

/** Map a skill to the pipeline stage whose model setting it should use. */
export function stageForSkill(skill: string): string {
	switch (skill) {
		case 'novel-feedback':
			return 'setup';
		case 'novel-generate':
			return 'initial';
		case 'novel-sync':
			return 'structure';
		case 'novel-verify':
			return 'manuscript';
		case 'novel-analyze':
			return 'publishable';
		default:
			return PIPELINE.find((s) => s.skill === skill)?.id ?? 'default';
	}
}

export const PREFIX_TO_STAGE: Record<string, SyncStage> = {
	THM: 'setup',
	STY: 'setup',
	RQ: 'research',
	CHR: 'world',
	PLC: 'world',
	ORG: 'world',
	OBJ: 'world',
	WLD: 'world',
	TML: 'world',
	GLS: 'world',
	FCT: 'world',
	SRC: 'world',
	ARC: 'narrative',
	BET: 'narrative',
	ILL: 'narrative',
	VOL: 'structure',
	ACT: 'structure',
	PRT: 'structure',
	CHP: 'structure',
	SCN: 'structure',
	DIR: 'structure'
};

export const STAGE_PREFIXES: Record<SyncStage, string[]> = {
	initial: [],
	setup: ['THM', 'STY'],
	research: ['RQ'],
	world: ['CHR', 'PLC', 'ORG', 'OBJ', 'WLD', 'TML', 'GLS', 'FCT', 'SRC'],
	narrative: ['ARC', 'BET', 'ILL'],
	structure: ['VOL', 'ACT', 'PRT', 'CHP', 'SCN', 'DIR'],
	abridged: [],
	manuscript: [],
	publishable: []
};

export function stageOfPath(path: string): SyncStage | null {
	const normalized = path.replace(/\\/g, '/');
	if (normalized.startsWith('initial/')) return 'initial';
	if (normalized.startsWith('setup/')) return 'setup';
	if (normalized.startsWith('research/')) return 'research';
	if (normalized.startsWith('world/') || normalized.startsWith('kb/')) return 'world';
	if (normalized.startsWith('narrative/')) return 'narrative';
	if (
		normalized.startsWith('structure/') ||
		normalized.startsWith('outline/') ||
		normalized.startsWith('directives/')
	) {
		return 'structure';
	}
	if (normalized.startsWith('abridged/')) return 'abridged';
	if (normalized.startsWith('manuscript/') || normalized.startsWith('story/')) return 'manuscript';
	if (normalized.startsWith('publishable/')) return 'publishable';
	return null;
}

export function stageOfId(id: string, path?: string): SyncStage | null {
	if (path) {
		const st = stageOfPath(path);
		if (st) return st;
	}
	const prefix = id.split('-')[0];
	return PREFIX_TO_STAGE[prefix] ?? null;
}

