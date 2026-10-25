/**
 * Dynamic stage actionability, context generation, and hover card metadata for the Journey Rail.
 * @spec JRN-001, JRN-002
 */
import type { PipelineStage } from '$lib/stages';
import type { StatusJson, CommitInfo } from '$lib/types';

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
}

export interface StageActionInfo {
	isActionable: boolean;
	title: string;
	description: string;
	disabledReason?: string;
	items: string[];
}

const STAGE_METHODOLOGY: Record<string, string> = {
	brief: 'Captures premise, audience, style mandate, and initial project configuration from the seed synopsis.',
	research: 'Investigates open research questions (RQ) and records authoritative cited facts (FCT/SRC) in the story bible.',
	outline: 'Builds and maintains reading-order parts, chapters, and scenes as a valid causal story DAG rooted at denouement.',
	graphics: 'Renders and synchronizes artwork, diagrams, maps, and book covers referenced by the story DAG.',
	abridged: 'Synthesizes condensed chapter drafts locking in plot momentum and essential dialogue before final prose.',
	manuscript: 'Renders final immersive prose adhering strictly to story/style.md, KB lore, and sensory grounding.',
	publish: 'Runs verification integrity checks, narrative audits, and compiles EPUB, PDF, and DOCX deliverables.'
};

const DEFAULT_ACTION_TITLES: Record<string, string> = {
	brief: 'Start Discovery Interview',
	research: 'Investigate Research Questions',
	outline: 'Structure Story Outline',
	graphics: 'Render Graphic Assets',
	abridged: 'Draft Abridged Chapters',
	manuscript: 'Draft Manuscript Prose',
	publish: 'Compile Book Deliverables'
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
export function getStageStepInfo(stage: PipelineStage, stageIndex: number): StageStepInfo {
	return {
		title: stage.label,
		sequenceLabel: `Stage ${stageIndex + 1} of 7`,
		description: stage.description,
		methodology: STAGE_METHODOLOGY[stage.id] || stage.description,
		paths: stage.paths,
		skill: stage.skill
	};
}

/**
 * Returns dynamic contextual explanation and enumerated items for a stage status pill.
 * @spec JRN-001
 */
export function getStagePillInfo(
	stage: PipelineStage,
	status: StatusJson | null,
	badge: string,
	pillStatus: 'needs-sync' | 'synced' | 'pending'
): StagePillInfo {
	const syncName = stage.sync;
	const rawDrift = (syncName && status?.drift?.[syncName]) || [];
	const driftItems = rawDrift.map(formatDriftItem).filter(Boolean);

	if (pillStatus === 'needs-sync') {
		if (stage.id === 'outline') {
			const rawUpstream = status?.upstream_drift?.outline ?? [];
			const upstreamItems = rawUpstream.map(formatDriftItem).filter(Boolean);
			const inferredUpstream = driftItems.filter(
				(item) => item.startsWith('story/') || item.startsWith('kb/')
			);
			const allUpstream = Array.from(new Set([...upstreamItems, ...inferredUpstream]));

			if (allUpstream.length > 0) {
				return {
					title: 'Upstream Changes Detected',
					badge,
					status: pillStatus,
					description: `${allUpstream.length} upstream item(s) have changed since ${stage.label} was last accepted.`,
					items: allUpstream
				};
			}

			if (driftItems.length > 0) {
				return {
					title: 'Outline Changes Detected',
					badge,
					status: pillStatus,
					description: `${driftItems.length} item(s) have changed in ${stage.label} since last sync.`,
					items: driftItems
				};
			}
		}

		if (driftItems.length > 0) {
			return {
				title: `Upstream Changes Detected`,
				badge,
				status: pillStatus,
				description: `${driftItems.length} upstream item(s) have changed since ${stage.label} was last accepted.`,
				items: driftItems
			};
		}

		let pendingCount = 0;
		if (stage.id === 'abridged') pendingCount = status?.pending?.abridged ?? 0;
		if (stage.id === 'manuscript') pendingCount = status?.pending?.manuscript ?? 0;
		if (stage.id === 'graphics') pendingCount = status?.graphics?.pending ?? 0;
		if (stage.id === 'research') pendingCount = status?.catalog?.['RQ'] ?? 0;

		const pendingItems =
			status?.pending_items?.[stage.id] ??
			(stage.id === 'graphics' ? status?.graphics?.pending_items : undefined) ??
			[];

		return {
			title: `Pending Generation`,
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
		description: `This stage has not yet been accepted.`,
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
			description: stage.prompt,
			items: []
		};
	}

	const syncName = stage.sync;
	const rawDrift = syncName && status.drift?.[syncName] ? status.drift[syncName] : [];
	const drift = rawDrift.map(formatDriftItem).filter(Boolean);

	switch (stage.id) {
		case 'brief': {
			const hasBaseline = Boolean(status.baselines?.['brief']);
			if (hasBaseline && drift.length === 0) {
				return {
					isActionable: false,
					title: 'Story Project Initialized',
					description: `Seed synopsis and brief have been completed and accepted.`,
					disabledReason: `Project plan has already been initialized and accepted. No synopsis changes detected.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: 'Start Discovery Interview',
				description: `Conduct author interview and initialize project specifications from synopsis.md.`,
				items: ['story/synopsis.md', 'story/brief.md', 'story/config.md', 'story/style.md']
			};
		}

		case 'research': {
			const openRQs = status.catalog?.['RQ'] ?? 0;
			const hasWork = openRQs > 0 || drift.length > 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Research Up to Date',
					description: `All research items and factual queries are resolved.`,
					disabledReason: `0 open research questions (RQ) and no factual changes detected.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: 'Investigate Research Questions',
				description: `Investigate ${openRQs > 0 ? `${openRQs} open research question(s)` : 'factual changes'} and compile cited sources.`,
				items: drift.length > 0 ? drift : [`${openRQs} open research question(s)`]
			};
		}

		case 'outline': {
			const hasBaseline = Boolean(status.baselines?.['outline']);
			const sceneCount = status.scenes?.outline ?? 0;
			const rawUpstream = status?.upstream_drift?.outline ?? [];
			const upstreamItems = rawUpstream.map(formatDriftItem).filter(Boolean);
			const allUpstream = Array.from(
				new Set([...upstreamItems, ...drift.filter((d) => d.startsWith('story/') || d.startsWith('kb/'))])
			);
			const hasWork = !hasBaseline || allUpstream.length > 0 || drift.length > 0 || sceneCount === 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Outline Up to Date',
					description: `The outline story DAG is up to date.`,
					disabledReason: `All ${sceneCount} outline scenes are structured and up to date. No upstream changes detected.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: 'Structure Story Outline',
				description:
					allUpstream.length > 0
						? `Update outline story DAG to incorporate ${allUpstream.length} changed upstream item(s).`
						: `Build or update chapter and scene DAG in outline/outline.md.`,
				items: allUpstream.length > 0 ? allUpstream : drift
			};
		}

		case 'graphics': {
			const pendingGfx = status.graphics?.pending ?? 0;
			const pendingItems = status.pending_items?.['graphics'] ?? status.graphics?.pending_items ?? [];
			const hasWork = pendingGfx > 0 || drift.length > 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Graphics Up to Date',
					description: `All graphic assets are rendered and up to date.`,
					disabledReason: `0 pending graphics and no story outline changes detected.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: 'Render Graphic Assets',
				description: `Render ${pendingGfx} active graphic asset(s) referenced by the outline.`,
				items: pendingItems.length > 0 ? pendingItems : drift
			};
		}

		case 'abridged': {
			const pendingAbridged = status.pending?.abridged ?? 0;
			const pendingItems = status.pending_items?.['abridged'] ?? [];
			const hasWork = pendingAbridged > 0 || drift.length > 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Abridged Drafts Up to Date',
					description: `All abridged drafts are up to date with the outline.`,
					disabledReason: `All ${status.scenes?.abridged ?? 0} abridged scenes are up to date.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: 'Draft Abridged Chapters',
				description: `Draft or update abridged chapters for ${pendingAbridged} impacted scene(s).`,
				items: pendingItems.length > 0 ? pendingItems : drift
			};
		}

		case 'manuscript': {
			const pendingManuscript = status.pending?.manuscript ?? 0;
			const pendingItems = status.pending_items?.['manuscript'] ?? [];
			const hasWork = pendingManuscript > 0 || drift.length > 0;
			if (!hasWork) {
				return {
					isActionable: false,
					title: 'Manuscript Up to Date',
					description: `All manuscript prose is fully rendered and up to date.`,
					disabledReason: `All ${status.scenes?.manuscript ?? 0} manuscript scenes are up to date with the style guide and story bible.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: 'Draft Manuscript Prose',
				description: `Render immersive prose for ${pendingManuscript} scene(s) adhering to story/style.md.`,
				items: pendingItems.length > 0 ? pendingItems : drift
			};
		}

		case 'publish': {
			const manuscriptScenes = status.scenes?.manuscript ?? 0;
			if (manuscriptScenes === 0) {
				return {
					isActionable: false,
					title: 'Compile Book Deliverables',
					description: `Manuscript has 0 rendered scenes.`,
					disabledReason: `Cannot compile deliverables: 0 rendered scenes exist in manuscript.`,
					items: []
				};
			}
			return {
				isActionable: true,
				title: 'Compile Book Deliverables',
				description: `Audit consistency, verify narrative pacing, and compile deliverable book formats.`,
				items: [`${manuscriptScenes} manuscript scenes ready for compilation`]
			};
		}

		default:
			return {
				isActionable: true,
				title: defaultTitle,
				description: stage.prompt,
				items: []
			};
	}
}
