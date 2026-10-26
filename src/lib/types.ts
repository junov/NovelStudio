/** Shapes of `specnovel.py ... --json` outputs consumed by the UI. */

export interface CommitInfo {
	sha?: string;
	date?: string;
	subject?: string;
	[k: string]: unknown;
}

export interface DriftItem {
	change?: string;
	file: string;
}

export interface StatusJson {
	title: string;
	baselines: Record<string, CommitInfo | string | null>;
	generatedStages?: Record<string, boolean>;
	catalog: Record<string, number>;
	beats?: number;
	scenes: { structure?: number; outline: number; abridged: number; manuscript: number };
	words: { abridged: number; manuscript: number };
	pending: { abridged: number; manuscript: number };
	pending_items?: Record<string, string[]>;
	illustrations?: { active: number; pending: number; inactive: number; pending_items?: string[] };
	graphics: { active: number; pending: number; inactive: number; pending_items?: string[] };
	directives?: number;
	placeholders: { total: number; untracked: number };
	drift: Record<string, Array<DriftItem | string>>;
	upstream_drift?: Record<string, Array<DriftItem | string>>;
	errors: string[];
	warnings: string[];
	infos: string[];
	next: string;
}

export interface WaveformEntry {
	index: number;
	scene: string;
	title: string;
	chapter: string;
	target_words: number;
	actual_words: number;
	dialogue_ratio: number;
	avg_sentence_len: number;
	cadence_entropy: number;
	sentences: number;
	paragraphs: number;
	emotional_valence: number;
	narrative_velocity: number;
}

export interface AuditJson {
	summary: {
		total_scenes: number;
		target_words: number;
		actual_words: number;
		overall_dialogue_ratio: number;
		average_cadence_entropy: number;
		total_cliches: number;
		total_passive_constructions: number;
		pacing_sags_detected: number;
		baseline_sha: string;
		cached_scenes_count: number;
		dirty_scenes_count: number;
	};
	waveform: WaveformEntry[];
	character_agency: { id: string; name: string; cast_count: number; pov_count: number; scenes: string[] }[];
	chekhov_matrix: {
		entity: string;
		plant_scene: string;
		payoff_scene: string;
		scene_gap: number;
		assessment: string;
		[k: string]: unknown;
	}[];
	epistemic_matrix: Record<string, { scene: string; learns: string[]; hidden_from: string[]; [k: string]: unknown }>;
	pacing_sag_sequences: string[][];
	sensory_palette: Record<string, number>;
	sensory_alerts: { scene: string; words: number; where: string }[];
	error?: string;
}

export interface AuditCompareJson {
	baseline_sha: string;
	metrics: Record<string, { baseline: number; current: number; delta: number }>;
	error?: string;
}
