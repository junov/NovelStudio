/**
 * Dynamic stage actionability, context generation, and hover card metadata for the Journey Rail.
 * @spec JRN-001, JRN-002
 */
import { PIPELINE, isStageGenerated, resolveStageExecution, type PipelineStage } from '$lib/stages';
import type { StatusJson } from '$lib/types';

export interface StageStepInfo {
	title: string;
	sequenceLabel: string;
	description: string;
	methodology: string;
	paths: string[];
	skill: string;
}

export interface StagePillInfo {
	title: string;
	description: string;
	badge: string;
	status: 'needs-sync' | 'synced' | 'pending';
	items: string[];
	lastAcceptedDate?: string;
	actionHint?: string;
}

export interface StageActionInfo {
	isActionable: boolean;
	title: string;
	description: string;
	disabledReason?: string;
	items: string[];
}

const STAGE_METHODOLOGY: Record<string, string> = {
	initial:
		'Establishes the seed synopsis and foundational project configuration in initial/ before creative discovery begins.',
	setup:
		'Conducts the creative discovery interview to define the narrative brief, themes (THM), and prose voice & style mandate (STY).',
	research:
		'Identifies factual, historical, and technical unknowns from the synopsis and setup, recording structured research questions (RQ) in research/questions.md.',
	world:
		'Investigates open research questions into cited sources (SRC) and facts (FCT), and builds the world catalog: characters (CHR), places (PLC), organizations (ORG), objects (OBJ), rules (WLD), timeline (TML), and glossary (GLS).',
	narrative:
		'Designs character/plot arcs (ARC), constructs the causal Narrative Beat DAG (BET) rooted at the Denouement, and specifies narrative illustrations (ILL) integrated into the DAG.',
	structure:
		'Maps every active Beat (BET) and Illustration (ILL) from the Narrative DAG into a linear reading-order hierarchy (VOL/ACT/PRT/CHP/SCN) in structure/outline.md, plus front and back matter.',
	abridged:
		'Synthesizes fast-paced condensed scenes in abridged/CHP-NNN.md covering all plot beats, character turns, and key dialogue to verify pacing before full prose.',
	manuscript:
		'Renders full, sensory-grounded literary prose in manuscript/<locale>/CHP-NNN.md from the abridged draft, strictly obeying setup/style.md, world lore, and active directives.',
	publishable:
		'Renders final visual artwork in publishable/graphics/ for active illustrations (ILL) and compiles publication-ready book deliverables (EPUB, PDF, DOCX, Markdown) into publishable/<locale>/.'
};

const DEFAULT_ACTION_TITLES: Record<string, string> = {
	initial: 'Initialize Seed Synopsis',
	setup: 'Start Discovery Interview',
	research: 'Formulate Research Questions',
	world: 'Generate World Bible & Resolve Research',
	narrative: 'Design Story Arcs & Beat DAG',
	structure: 'Sequence Chapter & Scene Structure',
	abridged: 'Draft Abridged Chapters',
	manuscript: 'Draft Manuscript Prose',
	publishable: 'Compile Book Deliverables'
};

/**
 * Safely normalizes a drift entry from specnovel.py (object or string) into a clean item name or path.
 * Strips Git-specific flags (M, A, D) so authors only see affected file paths and entity names.
 * @spec JRN-001
 */
export function formatDriftItem(item: unknown): string {
	if (!item) return '';
	if (typeof item === 'string') {
		return item.replace(/^[MADRCU?!]{1,2}\s+/, '').trim();
	}
	if (typeof item === 'object' && item !== null && 'file' in item) {
		const d = item as { change?: string; file?: string };
		return (d.file || '').trim();
	}
	return String(item).trim();
}

/**
 * Returns static and methodology information for a stage step hover card.
 * @spec JRN-001
 */
export function getStageStepInfo(
	stage: PipelineStage,
	stageIndex: number,
	status: StatusJson | null = null
): StageStepInfo {
	const resolved = resolveStageExecution(stage, status);
	return {
		title: stage.label,
		sequenceLabel: `Stage ${stageIndex + 1} of ${PIPELINE.length}`,
		description: stage.description,
		methodology: STAGE_METHODOLOGY[stage.id] || stage.description,
		paths: stage.paths,
		skill: resolved.skill
	};
}

/**
 * Filters unstaged file paths belonging to a stage.
 * Strictly checks actual modified or untracked files within the stage's paths,
 * ignoring directories, .gitkeep files, or collapsed folder summaries.
 * @spec JRN-003
 */
export function getStageUnstagedFiles(stage: PipelineStage, unstagedFiles: Set<string>): string[] {
	const stagePrefixes = stage.paths.map((p) => (p.includes('.') ? p : p.replace(/\/?$/, '/')));
	return Array.from(unstagedFiles).filter((f) => {
		if (!f || f.endsWith('/') || f.endsWith('.gitkeep')) return false;
		return stagePrefixes.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p));
	});
}

export interface StageAcceptInfo {
	title: string;
	description: string;
	files: string[];
}

/**
 * Derives contextual hover information for the stage "Accept" button.
 * Lists the files with uncommitted changes that belong to the stage.
 * @spec JRN-003
 */
export function getStageAcceptInfo(stage: PipelineStage, unstagedFiles?: Set<string>): StageAcceptInfo {
	const files = unstagedFiles ? getStageUnstagedFiles(stage, unstagedFiles) : [];
	return {
		title: `Accept Changes: ${stage.label}`,
		description:
			files.length === 1
				? '1 file with uncommitted changes ready to be committed and accepted into the stage baseline.'
				: `${files.length} files with uncommitted changes ready to be committed and accepted into the stage baseline.`,
		files
	};
}

/**
 * Checks whether an unbaselined stage has generated content ready for initial baseline acceptance.
 * @spec JRN-003
 */
export function hasStageGeneratedContent(
	stage: PipelineStage,
	status: StatusJson | null,
	files: { path: string }[]
): boolean {
	if (!status) return false;
	switch (stage.id) {
		case 'initial':
			return files.some((f) => f.path.startsWith('initial/synopsis.md') || f.path === 'initial/synopsis.md');
		case 'setup':
			return (status.catalog?.THM ?? 0) > 0 || files.some((f) => f.path.startsWith('setup/brief.md'));
		case 'research':
			return (status.catalog?.RQ ?? 0) > 0;
		case 'world':
			return (
				(status.catalog?.CHR ?? 0) > 0 ||
				(status.catalog?.PLC ?? 0) > 0 ||
				(status.catalog?.FCT ?? 0) > 0
			);
		case 'narrative':
			return (status.catalog?.ARC ?? 0) > 0 || (status.beats ?? 0) > 0;
		case 'structure':
			return (status.scenes?.structure ?? 0) > 0;
		case 'abridged':
			return (status.words?.abridged ?? 0) > 0;
		case 'manuscript':
			return (status.words?.manuscript ?? 0) > 0;
		case 'publishable':
			return (status.illustrations?.active ?? 0) > 0;
		default:
			return false;
	}
}

/**
 * Extracts upstream drift and local drift for a stage.
 */
function getStageDriftDetails(stage: PipelineStage, status: StatusJson | null) {
	const syncName = stage.sync;
	const rawDrift = (syncName && status?.drift?.[syncName]) || [];
	const driftItems = rawDrift.map(formatDriftItem).filter(Boolean);

	const rawUpstream = (syncName && status?.upstream_drift?.[syncName]) || [];
	const upstreamItems = rawUpstream.map(formatDriftItem).filter(Boolean);

	// Also separate any items in driftItems that belong to upstream folders rather than this stage's own folders
	const stagePrefixes = stage.paths.map((p) => p.split('/')[0] + '/');
	const inferredUpstream = driftItems.filter(
		(item) => item.includes('/') && !stagePrefixes.some((pre) => item.startsWith(pre))
	);
	const localDrift = driftItems.filter((item) => !inferredUpstream.includes(item));
	const allUpstream = Array.from(new Set([...upstreamItems, ...inferredUpstream]));
	const allChanged = Array.from(new Set([...allUpstream, ...localDrift]));

	return { localDrift, allUpstream, allChanged };
}

/**
 * Returns dynamic contextual explanation and enumerated items for a stage status pill.
 * @spec JRN-001, JRN-006
 */
export function getStagePillInfo(
	stage: PipelineStage,
	status: StatusJson | null,
	badge: string,
	pillStatus: 'needs-sync' | 'synced' | 'pending'
): StagePillInfo {
	const syncName = stage.sync;
	const { localDrift, allUpstream } = getStageDriftDetails(stage, status);

	if (pillStatus === 'needs-sync') {
		if (allUpstream.length > 0) {
			return {
				title: 'Upstream Changes Detected',
				badge,
				status: pillStatus,
				description: `${allUpstream.length} upstream item(s) have changed since ${stage.label} was last accepted.`,
				items: allUpstream,
				actionHint: 'Click to synchronize stage with upstream changes'
			};
		}

		if (localDrift.length > 0) {
			return {
				title: `${stage.label} Changes Detected`,
				badge,
				status: pillStatus,
				description: `${localDrift.length} item(s) have changed in ${stage.label} since last sync.`,
				items: localDrift,
				actionHint: 'Click to synchronize stage'
			};
		}

		let pendingCount = 0;
		if (stage.id === 'abridged') pendingCount = status?.pending?.abridged ?? 0;
		if (stage.id === 'manuscript') pendingCount = status?.pending?.manuscript ?? 0;
		if (stage.id === 'publishable') {
			pendingCount = status?.illustrations?.pending ?? status?.graphics?.pending ?? 0;
		}
		if (stage.id === 'research' || stage.id === 'world') {
			pendingCount =
				status?.pending_items?.['research']?.length ?? status?.catalog?.['RQ'] ?? 0;
		}

		const pendingItems =
			status?.pending_items?.[stage.id] ??
			(stage.id === 'publishable'
				? status?.pending_items?.['graphics'] ??
					status?.illustrations?.pending_items ??
					status?.graphics?.pending_items
				: undefined) ??
			(stage.id === 'world' ? status?.pending_items?.['research'] : undefined) ??
			[];

		if (badge === 'unaccepted' || (!status?.baselines?.[syncName] && pendingCount === 0)) {
			return {
				title: `${stage.label} Ready for Acceptance`,
				badge,
				status: pillStatus,
				description: `Initial content for ${stage.label} has been generated and is ready to be accepted into Git baseline.`,
				items: stage.paths
			};
		}

		return {
			title: 'Pending Generation',
			badge,
			status: pillStatus,
			description: `${pendingCount} item(s) require generation or updating in this stage.`,
			items: pendingItems
		};
	}

	if (pillStatus === 'synced') {
		const rawBaseline = syncName ? status?.baselines?.[syncName] : null;
		let lastAcceptedDate: string | undefined;
		if (rawBaseline && typeof rawBaseline === 'object' && 'date' in rawBaseline && rawBaseline.date) {
			lastAcceptedDate = String(rawBaseline.date).split('T')[0];
		}

		return {
			title: `${stage.label} Up to Date`,
			badge: 'synced',
			status: 'synced',
			description: `All files and artifacts for ${stage.label} are up to date with no pending changes.`,
			items: [],
			lastAcceptedDate
		};
	}

	return {
		title: `${stage.label} Not Yet Accepted`,
		badge: 'pending',
		status: 'pending',
		description: `This stage has not yet been generated and accepted.`,
		items: []
	};
}

/**
 * Evaluates whether a stage action play button is actionable and produces dynamic action context.
 * @spec JRN-001, JRN-002
 */
export function getStageActionInfo(stage: PipelineStage, status: StatusJson | null): StageActionInfo {
	const defaultTitle = DEFAULT_ACTION_TITLES[stage.id] ?? `Run ${stage.label}`;
	if (!status) {
		return {
			isActionable: true,
			title: defaultTitle,
			description: stage.description,
			items: stage.paths
		};
	}

	const isGenerated = isStageGenerated(stage, status);
	const { localDrift, allUpstream, allChanged } = getStageDriftDetails(stage, status);

	switch (stage.id) {
		case 'initial': {
			if (isGenerated && allChanged.length === 0) {
				return {
					isActionable: false,
					title: 'Initial Setup Accepted',
					description: 'Seed synopsis and initial project configuration have been completed and accepted.',
					disabledReason:
						'Initial synopsis and project configuration have already been accepted. No synopsis changes detected.',
					items: []
				};
			}
			return {
				isActionable: true,
				title: isGenerated ? 'Update Initial Synopsis & Config' : 'Initialize Seed Synopsis',
				description:
					'Capture or refine the seed synopsis and foundational project configuration in initial/.',
				items: allChanged.length > 0 ? allChanged : ['initial/synopsis.md', 'initial/config.md']
			};
		}

		case 'setup': {
			if (isGenerated && allChanged.length === 0) {
				return {
					isActionable: false,
					title: 'Setup Up to Date',
					description: 'Creative brief, themes, and style guide are completed and up to date.',
					disabledReason:
						'Creative brief, themes (THM), and style rules (STY) are up to date with no upstream changes detected.',
					items: []
				};
			}
			return {
				isActionable: true,
				title: isGenerated ? 'Synchronize Creative Setup' : 'Start Discovery Interview',
				description:
					allUpstream.length > 0
						? `Update setup/brief.md, setup/themes.md, and setup/style.md to incorporate ${allUpstream.length} changed upstream item(s).`
						: 'Conduct author discovery interview and establish setup/brief.md, setup/themes.md, and setup/style.md.',
				items:
					allChanged.length > 0
						? allChanged
						: ['setup/brief.md', 'setup/themes.md', 'setup/style.md']
			};
		}

		case 'research': {
			if (isGenerated && allChanged.length === 0) {
				return {
					isActionable: false,
					title: 'Research Questions Up to Date',
					description: 'Research questions in research/questions.md are up to date.',
					disabledReason:
						'Research questions (RQ) are formulated and up to date with no upstream changes detected.',
					items: []
				};
			}
			return {
				isActionable: true,
				title: isGenerated ? 'Synchronize Research Questions' : 'Formulate Research Questions',
				description:
					allUpstream.length > 0
						? `Update research/questions.md to incorporate ${allUpstream.length} changed upstream item(s).`
						: 'Identify factual, historical, and technical research questions (RQ) in research/questions.md.',
				items: allChanged.length > 0 ? allChanged : ['research/questions.md']
			};
		}

		case 'world': {
			const openRQs =
				status.pending_items?.['research']?.length ?? status.catalog?.['RQ'] ?? 0;
			const hasWork = !isGenerated || openRQs > 0 || allChanged.length > 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'World Bible Up to Date',
					description: 'All research questions are resolved and world entities are up to date.',
					disabledReason:
						'0 open research questions (RQ) and no world bible or upstream changes detected.',
					items: []
				};
			}
			return {
				isActionable: true,
				title: isGenerated
					? 'Synchronize World & Resolve Research'
					: 'Generate World Bible & Resolve Research',
				description:
					openRQs > 0
						? `Investigate ${openRQs} open research question(s) into cited facts (FCT/SRC) and update world/ entities.`
						: 'Build and synchronize canonical characters, places, rules, timeline, and facts in world/.',
				items:
					allChanged.length > 0
						? allChanged
						: openRQs > 0
							? [`${openRQs} open research question(s)`]
							: ['world/INDEX.md']
			};
		}

		case 'narrative': {
			const beatCount = status.beats ?? status.catalog?.['BET'] ?? 0;
			const hasWork = !isGenerated || allChanged.length > 0 || beatCount === 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Narrative DAG Up to Date',
					description: 'Story arcs, narrative beats, and illustration specs are up to date.',
					disabledReason: `All ${beatCount} narrative beat(s) and story arcs are up to date with no upstream changes detected.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: isGenerated
					? 'Synchronize Narrative Arcs & Beat DAG'
					: 'Design Story Arcs & Beat DAG',
				description:
					allUpstream.length > 0
						? `Update narrative arcs, Beat DAG, and illustration specs to incorporate ${allUpstream.length} changed upstream item(s).`
						: 'Design story arcs (ARC), causal narrative beats (BET), and illustration specs (ILL) in narrative/.',
				items:
					allChanged.length > 0
						? allChanged
						: ['narrative/arcs.md', 'narrative/beats.md', 'narrative/illustrations.md']
			};
		}

		case 'structure': {
			const sceneCount = status.scenes?.structure ?? status.scenes?.outline ?? 0;
			const hasWork = !isGenerated || allChanged.length > 0 || sceneCount === 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Structure Outline Up to Date',
					description: 'The chapter and scene reading-order outline is up to date.',
					disabledReason: `All ${sceneCount} structure scene(s) are sequenced and up to date. No upstream changes detected.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: isGenerated
					? 'Synchronize Chapter & Scene Structure'
					: 'Sequence Chapter & Scene Structure',
				description:
					allUpstream.length > 0
						? `Update structure/outline.md to incorporate ${allUpstream.length} changed upstream item(s).`
						: 'Sequence active narrative beats and illustrations into chapters and scenes in structure/outline.md.',
				items: allUpstream.length > 0 ? allUpstream : localDrift.length > 0 ? localDrift : ['structure/outline.md']
			};
		}

		case 'abridged': {
			const sceneCount = status.scenes?.structure ?? status.scenes?.outline ?? 0;
			const pendingAbridged = status.pending?.abridged ?? 0;
			const pendingItems = status.pending_items?.['abridged'] ?? [];
			if (!isGenerated && sceneCount === 0 && pendingAbridged === 0) {
				return {
					isActionable: false,
					title: 'Draft Abridged Chapters',
					description: 'Structure outline has 0 sequenced scenes.',
					disabledReason:
						'Cannot draft abridged chapters yet: 0 scenes are sequenced in structure/outline.md.',
					items: []
				};
			}
			const hasWork = !isGenerated || pendingAbridged > 0 || allChanged.length > 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Abridged Drafts Up to Date',
					description: 'All abridged chapter drafts are up to date with the structure outline.',
					disabledReason: `All ${status.scenes?.abridged ?? 0} abridged scenes are up to date.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: 'Draft Abridged Chapters',
				description: `Draft or update abridged chapters for ${pendingAbridged || sceneCount} impacted scene(s).`,
				items: pendingItems.length > 0 ? pendingItems : allChanged
			};
		}

		case 'manuscript': {
			const abridgedScenes = status.scenes?.abridged ?? 0;
			const pendingManuscript = status.pending?.manuscript ?? 0;
			const pendingItems = status.pending_items?.['manuscript'] ?? [];
			if (!isGenerated && abridgedScenes === 0 && pendingManuscript === 0) {
				return {
					isActionable: false,
					title: 'Draft Manuscript Prose',
					description: 'Abridged stage has 0 drafted scenes.',
					disabledReason:
						'Cannot render manuscript prose yet: 0 abridged scenes exist in abridged/.',
					items: []
				};
			}
			const hasWork = !isGenerated || pendingManuscript > 0 || allChanged.length > 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Manuscript Up to Date',
					description: 'All manuscript prose is fully rendered and up to date.',
					disabledReason: `All ${status.scenes?.manuscript ?? 0} manuscript scenes are up to date with setup/style.md and world lore.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: 'Draft Manuscript Prose',
				description: `Render immersive prose for ${pendingManuscript || abridgedScenes} scene(s) adhering to setup/style.md.`,
				items: pendingItems.length > 0 ? pendingItems : allChanged
			};
		}

		case 'publishable': {
			const manuscriptScenes = status.scenes?.manuscript ?? 0;
			const pendingIll = status.illustrations?.pending ?? status.graphics?.pending ?? 0;
			const pendingItems =
				status.pending_items?.['publishable'] ??
				status.pending_items?.['graphics'] ??
				status.illustrations?.pending_items ??
				status.graphics?.pending_items ??
				[];
			if (manuscriptScenes === 0 && pendingIll === 0) {
				return {
					isActionable: false,
					title: 'Compile Book Deliverables',
					description: 'Manuscript has 0 rendered scenes.',
					disabledReason:
						'Cannot compile deliverables: 0 rendered scenes exist in manuscript and 0 active illustrations are pending.',
					items: []
				};
			}
			const hasWork = !isGenerated || pendingIll > 0 || allChanged.length > 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Publishable Deliverables Up to Date',
					description: 'All active illustrations and compiled book deliverables are up to date.',
					disabledReason: `All ${manuscriptScenes} manuscript scene(s) and ${status.illustrations?.active ?? status.graphics?.active ?? 0} active graphic/illustration asset(s) are up to date.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title:
					pendingIll > 0 ? 'Render Illustrations & Compile Book' : 'Compile Book Deliverables',
				description:
					pendingIll > 0
						? `Render ${pendingIll} active graphic/illustration asset(s) in publishable/graphics/ and compile book deliverables.`
						: 'Audit consistency, verify narrative pacing, and compile deliverable book formats into publishable/.',
				items:
					pendingItems.length > 0
						? pendingItems
						: allChanged.length > 0
							? allChanged
							: [`${manuscriptScenes} manuscript scenes ready for compilation`]
			};
		}

		default:
			return {
				isActionable: true,
				title: defaultTitle,
				description: stage.description,
				items: []
			};
	}
}
