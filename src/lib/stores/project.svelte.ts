/**
 * The currently open novel project: file list, wiki-link index, specnovel status and navigation.
 */
import {
	listFiles,
	scanMarkdown,
	specnovelJson,
	readText,
	readBytes,
	writeText,
	runSpecnovel,
	runGit,
	type FileEntry
} from '$lib/tauri';
import { parseFile, preferDefinition, type Definition, type Reference } from '$lib/entities';
import type { StatusJson } from '$lib/types';
import { getUnstagedFiles, acceptGitFile, revertGitFile } from '$lib/git';
import { stageOfPath, stageOfId, type SyncStage, PIPELINE } from '$lib/stages';
import { getStageUnstagedFiles } from '$lib/stagesHover';

export type View =
	| { kind: 'dashboard' }
	| { kind: 'file'; path: string; line?: number; id?: string }
	| { kind: 'entities'; prefix: string }
	| { kind: 'analysis'; report?: string }
	| { kind: 'book' }
	| { kind: 'settings' };

export const viewKey = (v: View) =>
	v.kind === 'file' ? `file:${v.path}` : v.kind === 'entities' ? `entities:${v.prefix}` : v.kind;

class ProjectState {
	root = $state<string | null>(null);
	files = $state<FileEntry[]>([]);
	defs = $state<Record<string, Definition>>({});
	/** Every definition including duplicates in draft layers, keyed by id. */
	allDefs = $state<Record<string, Definition[]>>({});
	/** Backlinks: target id → references to it. */
	backlinks = $state<Record<string, Reference[]>>({});
	/** Outgoing references by file path. */
	outgoing = $state<Record<string, Reference[]>>({});
	status = $state<StatusJson | null>(null);
	statusError = $state<string | null>(null);
	loading = $state(false);
	/** Unstaged files tracked for review/accept flow (@spec REV-001). */
	unstagedFiles = $state<Set<string>>(new Set());
	/** Bumped whenever files change on disk so open editors can reload. */
	revision = $state(0);
	/** Currently active pipeline stage (@spec JRN-004, BBL-005). */
	currentStage = $state<SyncStage>('initial');
	/** Stages that have been generated at least once (@spec JRN-005). */
	generatedStages = $state<Set<string>>(new Set());

	view = $state<View>({ kind: 'dashboard' });
	#back: View[] = [];
	#forward: View[] = [];
	canBack = $state(false);
	canForward = $state(false);

	get title() {
		return this.status?.title || this.root?.split(/[\\/]/).pop() || 'Untitled';
	}

	async open(root: string) {
		this.root = root;
		this.view = { kind: 'dashboard' };
		this.#back = [];
		this.#forward = [];
		this.#syncNav();
		try {
			const saved = localStorage.getItem(`novelstudio.generated_stages:${root}`);
			this.generatedStages = saved ? new Set(JSON.parse(saved)) : new Set();
		} catch {
			this.generatedStages = new Set();
		}
		await this.refresh();
	}

	close() {
		this.root = null;
		this.files = [];
		this.defs = {};
		this.backlinks = {};
		this.status = null;
		this.currentStage = 'initial';
		this.generatedStages = new Set();
	}

	markStageGenerated(stageId: string) {
		const next = new Set(this.generatedStages);
		next.add(stageId);
		this.generatedStages = next;
		if (this.root) {
			try {
				localStorage.setItem(
					`novelstudio.generated_stages:${this.root}`,
					JSON.stringify(Array.from(this.generatedStages))
				);
			} catch {
				// ignore localStorage errors
			}
		}
	}

	isStageGenerated(stageId: string): boolean {
		if (this.status?.baselines?.[stageId]) return true;
		if (this.status?.generatedStages?.[stageId]) return true;
		if (this.generatedStages.has(stageId)) return true;
		const status = this.status;
		if (status) {
			if (stageId === 'setup' && ((status.catalog?.THM ?? 0) > 0 || (status.catalog?.STY ?? 0) > 0)) {
				return true;
			}
			if (stageId === 'research' && (status.catalog?.RQ ?? 0) > 0) return true;
			if (
				stageId === 'world' &&
				((status.catalog?.CHR ?? 0) > 0 ||
					(status.catalog?.PLC ?? 0) > 0 ||
					(status.catalog?.FCT ?? 0) > 0)
			) {
				return true;
			}
			if (stageId === 'narrative' && ((status.catalog?.ARC ?? 0) > 0 || (status.beats ?? 0) > 0)) {
				return true;
			}
			if (stageId === 'structure' && (status.scenes?.structure ?? 0) > 0) return true;
			if (stageId === 'abridged' && (status.words?.abridged ?? 0) > 0) return true;
			if (stageId === 'manuscript' && (status.words?.manuscript ?? 0) > 0) return true;
			if (stageId === 'publishable' && (status.illustrations?.active ?? 0) > 0) return true;
		}
		return false;
	}

	/** Re-scan files, rebuild the wiki-link index, check git status, and refresh `status --json`. */
	async refresh() {
		if (!this.root) return;
		this.loading = true;
		try {
			await Promise.all([this.reindex(), this.refreshStatus(), this.refreshGitStatus()]);
			this.revision++;
		} finally {
			this.loading = false;
		}
	}

	async reindex() {
		if (!this.root) return;
		const [files, md] = await Promise.all([listFiles(this.root), scanMarkdown(this.root)]);
		const defs: Record<string, Definition> = {};
		const allDefs: Record<string, Definition[]> = {};
		const backlinks: Record<string, Reference[]> = {};
		const outgoing: Record<string, Reference[]> = {};
		for (const f of md) {
			const parsed = parseFile(f.path, f.content);
			for (const d of parsed.defs) {
				defs[d.id] = preferDefinition(defs[d.id], d);
				(allDefs[d.id] ??= []).push(d);
			}
			outgoing[f.path] = parsed.refs;
			for (const r of parsed.refs) (backlinks[r.id] ??= []).push(r);
		}
		this.files = files;
		this.defs = defs;
		this.allDefs = allDefs;
		this.backlinks = backlinks;
		this.outgoing = outgoing;
	}

	async refreshStatus() {
		if (!this.root) return;
		try {
			this.status = await specnovelJson<StatusJson>(this.root, ['status']);
			this.statusError = null;
		} catch (e) {
			this.statusError = String(e);
		}
	}

	titleOf = (id: string): string | undefined => this.defs[id]?.title;
	hasId = (id: string): boolean => Boolean(this.defs[id]);

	read(path: string) {
		return readText(this.root!, path);
	}

	readBytes(path: string) {
		return readBytes(this.root!, path);
	}

	async write(path: string, content: string) {
		await writeText(this.root!, path, content);
		await this.refreshGitStatus();
	}

	/**
	 * Git review & accept status tracking.
	 * @spec REV-001, REV-002
	 */
	async refreshGitStatus() {
		if (!this.root) return;
		this.unstagedFiles = await getUnstagedFiles(this.root);
	}

	hasUnstagedChanges(path: string): boolean {
		const normalized = path.replace(/\\/g, '/');
		return this.unstagedFiles.has(normalized);
	}

	hasItemUnstagedChanges(id: string): boolean {
		const def = this.defs[id];
		if (!def) return false;
		return this.hasUnstagedChanges(def.path);
	}

	async acceptFile(path: string): Promise<boolean> {
		if (!this.root) return false;
		const ok = await acceptGitFile(this.root, path);
		if (ok) {
			const normalized = path.replace(/\\/g, '/');
			const next = new Set(this.unstagedFiles);
			next.delete(normalized);
			this.unstagedFiles = next;
			await this.refresh();
		}
		return ok;
	}

	async revertFile(path: string): Promise<boolean> {
		if (!this.root) return false;
		const ok = await revertGitFile(this.root, path);
		if (ok) {
			const normalized = path.replace(/\\/g, '/');
			const next = new Set(this.unstagedFiles);
			next.delete(normalized);
			this.unstagedFiles = next;
			await this.refresh();
		}
		return ok;
	}

	async acceptItem(id: string): Promise<boolean> {
		const def = this.defs[id];
		if (!def) return false;
		return this.acceptFile(def.path);
	}

	async revertItem(id: string): Promise<boolean> {
		const def = this.defs[id];
		if (!def) return false;
		return this.revertFile(def.path);
	}

	/**
	 * Accept and baseline a pipeline stage using `specnovel accept --stage <stage>`.
	 * Commits changes with the appropriate Novel-Sync trailer.
	 * Automatically overrides non-fatal check warnings with --force.
	 * @spec JRN-003, REV-002
	 */
	async acceptStage(
		stageName: string,
		message?: string,
		force = true
	): Promise<{ success: boolean; error?: string }> {
		if (!this.root) return { success: false, error: 'No active project' };
		// Ensure git identity if not configured
		try {
			const checkEmail = await runGit(this.root, ['config', 'user.email']);
			if (checkEmail.code !== 0 || !checkEmail.stdout.trim()) {
				await runGit(this.root, ['config', 'user.email', 'author@novelstudio.local']);
				await runGit(this.root, ['config', 'user.name', 'NovelStudio Author']);
			}
		} catch {
			// ignore fallback
		}

		const args = ['accept', '--stage', stageName];
		if (message) {
			args.push('-m', message);
		} else {
			args.push('-m', `Accept ${stageName} stage`);
		}
		let res = await runSpecnovel(this.root, args);
		if (res.code !== 0 && (force || res.stderr?.includes('--force') || res.stdout?.includes('--force'))) {
			res = await runSpecnovel(this.root, [...args, '--force']);
		}

		if (res.code === 0) {
			this.markStageGenerated(stageName);
			// Optimistically clear unstaged files belonging to this stage so the UI updates immediately (@spec JRN-003)
			const stageObj = PIPELINE.find((s) => s.id === stageName || s.sync === stageName);
			if (stageObj) {
				const stageFiles = new Set(getStageUnstagedFiles(stageObj, this.unstagedFiles));
				if (stageFiles.size > 0) {
					this.unstagedFiles = new Set([...this.unstagedFiles].filter((f) => !stageFiles.has(f)));
				}
			}
			await this.refresh();
			return { success: true };
		} else {
			return { success: false, error: res.stderr || res.stdout || 'Failed to accept stage' };
		}
	}

	// ---------------------------------------------------------------- navigation
	navigate(v: View) {
		if (viewKey(v) === viewKey(this.view) && v.kind !== 'file') return;
		this.#back.push(this.view);
		this.#forward = [];
		this.view = v;
		this.#syncNav();
	}

	setCurrentStage(stage: SyncStage) {
		this.currentStage = stage;
	}

	openFile(path: string, line?: number) {
		const targetStage = stageOfPath(path);
		if (targetStage) {
			this.setCurrentStage(targetStage);
		}
		this.navigate({ kind: 'file', path, line });
	}

	/**
	 * Follow a wiki-link: open the defining file at the heading line.
	 * Centralized entity navigation entry point.
	 * @spec BBL-003
	 */
	openId(id: string): boolean {
		const d = this.defs[id];
		if (!d) return false;
		const targetStage = stageOfPath(d.path) || stageOfId(id);
		if (targetStage) {
			this.setCurrentStage(targetStage);
		}
		this.navigate({ kind: 'file', path: d.path, line: d.line, id });
		return true;
	}

	back() {
		const v = this.#back.pop();
		if (!v) return;
		this.#forward.push(this.view);
		this.view = v;
		this.#syncNav();
	}

	forward() {
		const v = this.#forward.pop();
		if (!v) return;
		this.#back.push(this.view);
		this.view = v;
		this.#syncNav();
	}

	#syncNav() {
		this.canBack = this.#back.length > 0;
		this.canForward = this.#forward.length > 0;
	}
}

export const project = new ProjectState();
