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
	type FileEntry
} from '$lib/tauri';
import { parseFile, preferDefinition, type Definition, type Reference } from '$lib/entities';
import type { StatusJson } from '$lib/types';

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

	/** Re-scan files, rebuild the wiki-link index and refresh `status --json`. */
	async refresh() {
		if (!this.root) return;
		this.loading = true;
		try {
			await Promise.all([this.reindex(), this.refreshStatus()]);
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
