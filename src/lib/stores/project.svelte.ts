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
		await this.refresh();
	}

	close() {
		this.root = null;
		this.files = [];
		this.defs = {};
		this.backlinks = {};
		this.status = null;
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
	 * @spec JRN-003, REV-002
	 */
	async acceptStage(stageName: string, message?: string): Promise<{ success: boolean; error?: string }> {
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
		const res = await runSpecnovel(this.root, args);
		if (res.code === 0) {
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

	openFile(path: string, line?: number) {
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
