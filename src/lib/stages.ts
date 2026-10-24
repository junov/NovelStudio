/**
 * The SpecNovelist pipeline as presented in the Journey Rail.
 * `sync` is the `Novel-Sync:` stage name used by `specnovel.py accept --stage`.
 */

export type SyncStage = 'brief' | 'research' | 'bible' | 'outline' | 'graphics' | 'abridged' | 'manuscript';

export interface PipelineStage {
	id: string;
	label: string;
	sync?: SyncStage;
	/** Primary SpecNovelist skill that drives this stage. */
	skill: string;
	/** Other skills offered as secondary actions. */
	extraSkills?: string[];
	description: string;
	/** Files/folders that belong to this stage (for the explorer and "open" actions). */
	paths: string[];
	/** Default instruction sent to the agent when the stage's action is launched. */
	prompt: string;
}

export const PIPELINE: PipelineStage[] = [
	{
		id: 'brief',
		label: 'Brief',
		sync: 'brief',
		skill: 'novel-init',
		description: 'Seed synopsis + discovery interview → brief, config, style guide, seeded KB.',
		paths: ['story/synopsis.md', 'story/brief.md', 'story/config.md', 'story/style.md'],
		prompt:
			'Run novel-init for this project. The synopsis is in story/synopsis.md. Use the ask_user tool for every interview round.'
	},
	{
		id: 'research',
		label: 'Research',
		sync: 'research',
		skill: 'novel-research',
		description: 'Answer research questions with authoritative, cited sources (SRC/FCT).',
		paths: ['kb/research', 'kb/sources', 'kb/facts'],
		prompt: 'Run novel-research: work through the open research questions, highest priority first.'
	},
	{
		id: 'bible',
		label: 'Story Bible',
		sync: 'bible',
		skill: 'novel-author',
		description: 'Flesh out characters, places, plot threads, themes and world rules.',
		paths: ['kb/characters', 'kb/places', 'kb/organizations', 'kb/objects', 'kb/plot', 'kb/themes', 'kb/world', 'kb/timeline'],
		prompt: 'Run novel-author: review the story bible with me and fill the most important gaps.'
	},
	{
		id: 'outline',
		label: 'Outline',
		sync: 'outline',
		skill: 'novel-outline',
		description: 'Build the reading-order skeleton (PRT → CHP → SCN) as a valid story DAG.',
		paths: ['outline/outline.md'],
		prompt: 'Run novel-outline: build or update the outline in outline/outline.md.'
	},
	{
		id: 'graphics',
		label: 'Graphics',
		sync: 'graphics',
		skill: 'novel-sync',
		description: 'Render active graphic assets referenced by the story DAG.',
		paths: ['kb/graphics', 'graphics'],
		prompt: 'Run novel-sync for the graphics stage: report which GFX assets need rendering.'
	},
	{
		id: 'abridged',
		label: 'Abridged',
		sync: 'abridged',
		skill: 'novel-abridge',
		extraSkills: ['novel-sync'],
		description: 'All plot and key dialogue, lean description — review pacing fast.',
		paths: ['abridged'],
		prompt: 'Run novel-abridge: draft or update the abridged chapters for impacted scenes.'
	},
	{
		id: 'manuscript',
		label: 'Manuscript',
		sync: 'manuscript',
		skill: 'novel-write',
		extraSkills: ['novel-sync', 'novel-verify'],
		description: 'Render immersive prose from the abridged draft, style guide and KB.',
		paths: ['manuscript'],
		prompt: 'Run novel-write: render the manuscript for impacted scenes.'
	},
	{
		id: 'publish',
		label: 'Publish',
		skill: 'novel-publish',
		extraSkills: ['novel-verify', 'novel-analyze'],
		description: 'Verify, analyze and compile EPUB / PDF / DOCX.',
		paths: ['build'],
		prompt: 'Run novel-publish: prepare the book for compilation.'
	}
];

export const SKILLS = [
	'novel-init',
	'novel-research',
	'novel-author',
	'novel-outline',
	'novel-abridge',
	'novel-write',
	'novel-sync',
	'novel-verify',
	'novel-analyze',
	'novel-publish'
] as const;
export type SkillName = (typeof SKILLS)[number];

/** Map a skill to the pipeline stage whose model setting it should use. */
export function stageForSkill(skill: string): string {
	return PIPELINE.find((s) => s.skill === skill)?.id ?? 'default';
}
