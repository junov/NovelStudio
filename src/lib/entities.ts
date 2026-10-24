/**
 * SpecNovelist entity model: ID prefixes, wiki-link parsing, definitions and backlinks.
 * Regexes mirror `specnovel.py` (ID_PATTERN, ID_HEADING_RE, REF_RE).
 */

export const ID_PATTERN = '[A-Z][A-Z0-9]*-\\d{3,}';
export const ID_RE = new RegExp(`^${ID_PATTERN}$`);
/** Matches `[[ID]]` and `[[ID|alias]]`; group 1 = id, group 2 = alias. */
export const WIKI_RE = new RegExp(`\\[\\[\\s*(${ID_PATTERN})\\s*(?:\\|\\s*([^\\]]*?)\\s*)?\\]\\]`, 'g');
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ID_HEADING_RE = new RegExp(`^(${ID_PATTERN})\\s*[:.\\-\\u2013\\u2014]\\s*(.+)$`);

export interface PrefixInfo {
	label: string;
	plural: string;
	folder: string;
	/** CSS custom-property hue (0-360) for chips. */
	hue: number;
	icon: string;
}

export const PREFIXES: Record<string, PrefixInfo> = {
	CHR: { label: 'Character', plural: 'Characters', folder: 'kb/characters', hue: 12, icon: '👤' },
	PLC: { label: 'Place', plural: 'Places', folder: 'kb/places', hue: 140, icon: '📍' },
	ORG: { label: 'Organization', plural: 'Organizations', folder: 'kb/organizations', hue: 200, icon: '🏛' },
	OBJ: { label: 'Object', plural: 'Objects', folder: 'kb/objects', hue: 40, icon: '🗝' },
	PLT: { label: 'Plot element', plural: 'Plot', folder: 'kb/plot', hue: 330, icon: '🧵' },
	THM: { label: 'Theme', plural: 'Themes', folder: 'kb/themes', hue: 280, icon: '✨' },
	WLD: { label: 'World rule', plural: 'World', folder: 'kb/world', hue: 175, icon: '🌐' },
	TML: { label: 'Timeline event', plural: 'Timeline', folder: 'kb/timeline', hue: 230, icon: '⏳' },
	GFX: { label: 'Graphic', plural: 'Graphics', folder: 'kb/graphics', hue: 300, icon: '🖼' },
	GLS: { label: 'Glossary term', plural: 'Glossary', folder: 'kb/glossary', hue: 90, icon: '📖' },
	FCT: { label: 'Fact', plural: 'Facts', folder: 'kb/facts', hue: 160, icon: '✔' },
	SRC: { label: 'Source', plural: 'Sources', folder: 'kb/sources', hue: 25, icon: '📚' },
	RQ: { label: 'Research question', plural: 'Research', folder: 'kb/research', hue: 55, icon: '❓' },
	STY: { label: 'Style rule', plural: 'Style rules', folder: 'story', hue: 260, icon: '🖋' },
	EDT: { label: 'Editorial directive', plural: 'Editorial', folder: 'story/editorial', hue: 0, icon: '✎' },
	PRT: { label: 'Part', plural: 'Parts', folder: 'outline', hue: 210, icon: '📕' },
	CHP: { label: 'Chapter', plural: 'Chapters', folder: 'outline', hue: 215, icon: '📄' },
	SCN: { label: 'Scene', plural: 'Scenes', folder: 'outline', hue: 220, icon: '🎬' }
};

export const prefixOf = (id: string) => id.split('-')[0];
export const prefixInfo = (id: string): PrefixInfo =>
	PREFIXES[prefixOf(id)] ?? { label: 'Entity', plural: 'Other', folder: '', hue: 0, icon: '•' };

export type Layer = 'plan' | 'abridged' | 'manuscript' | 'other';

export function layerOf(path: string): Layer {
	if (path.startsWith('abridged/')) return 'abridged';
	if (path.startsWith('manuscript/')) return 'manuscript';
	if (path.startsWith('kb/') || path.startsWith('outline/') || path.startsWith('story/')) return 'plan';
	return 'other';
}

export interface Definition {
	id: string;
	title: string;
	path: string;
	/** 1-based line number of the heading. */
	line: number;
	level: number;
	layer: Layer;
}

export interface Reference {
	id: string;
	alias?: string;
	path: string;
	line: number;
	/** Trimmed text of the referencing line. */
	snippet: string;
	/** Nearest enclosing ID heading in the referencing file (e.g. the scene). */
	context?: string;
}

/** Parse ID headings (definitions) and wiki-link references from one markdown file. */
export function parseFile(path: string, text: string): { defs: Definition[]; refs: Reference[] } {
	const defs: Definition[] = [];
	const refs: Reference[] = [];
	const layer = layerOf(path);
	const lines = text.split(/\r?\n/);
	let inFence = false;
	let inComment = false;
	let context: string | undefined;
	lines.forEach((raw, i) => {
		if (/^\s*(```|~~~)/.test(raw)) {
			inFence = !inFence;
			return;
		}
		if (inFence) return;
		let line = raw;
		// Strip HTML comments (templates are full of guidance comments).
		if (inComment) {
			const end = line.indexOf('-->');
			if (end < 0) return;
			line = line.slice(end + 3);
			inComment = false;
		}
		line = line.replace(/<!--.*?-->/g, '');
		const open = line.indexOf('<!--');
		if (open >= 0) {
			line = line.slice(0, open);
			inComment = true;
		}
		const h = HEADING_RE.exec(line);
		if (h) {
			const m = ID_HEADING_RE.exec(h[2]);
			if (m) {
				defs.push({ id: m[1], title: m[2].trim(), path, line: i + 1, level: h[1].length, layer });
				context = m[1];
			}
		}
		for (const r of line.matchAll(WIKI_RE)) {
			refs.push({
				id: r[1],
				alias: r[2] || undefined,
				path,
				line: i + 1,
				snippet: line.trim(),
				context
			});
		}
	});
	return { defs, refs };
}

/** Choose the canonical definition: plan layer (kb/outline/story) beats drafts. */
export function preferDefinition(a: Definition | undefined, b: Definition): Definition {
	if (!a) return b;
	const rank = (d: Definition) => (d.layer === 'plan' ? 0 : d.layer === 'abridged' ? 1 : 2);
	return rank(b) < rank(a) ? b : a;
}

/** Remove wiki-link syntax for display: `[[CHR-001|Elena]]` → `Elena`, `[[CHR-001]]` → title or ID. */
export function stripWiki(text: string, titleOf?: (id: string) => string | undefined): string {
	return text.replace(WIKI_RE, (_m, id: string, alias?: string) => alias || titleOf?.(id) || id);
}

export const isMarkdown = (path: string) => /\.(md|markdown)$/i.test(path);
export const isImage = (path: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(path);
