/**
 * Read-only markdown rendering with SpecNovelist wiki-links rendered as clickable entity chips.
 * Clicks are handled by `wikiClick` (event delegation) — see `use:wikiLinks` in actions.ts.
 */
import MarkdownIt from 'markdown-it';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import { ID_PATTERN, prefixInfo, prefixOf } from '$lib/entities';

const WIKI_AT = new RegExp(`^\\[\\[\\s*(${ID_PATTERN})\\s*(?:\\|\\s*([^\\]]*?)\\s*)?\\]\\]`);

export interface RenderOptions {
	titleOf?: (id: string) => string | undefined;
	exists?: (id: string) => boolean;
}

function escapeHtml(s: string) {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function chipHtml(id: string, alias: string | undefined, opts: RenderOptions = {}) {
	const info = prefixInfo(id);
	const title = opts.titleOf?.(id);
	const missing = opts.exists && !opts.exists(id);
	const label = alias || id;
	const tip = `${info.label} ${id}${title ? ` — ${title}` : ''}${missing ? ' (not defined)' : ''}`;
	return `<a class="wiki-chip${missing ? ' missing' : ''}" data-wiki="${id}" data-prefix="${prefixOf(id)}" style="--hue:${info.hue}" title="${escapeHtml(tip)}" href="#${id}">${escapeHtml(label)}</a>`;
}

function wikiPlugin(md: MarkdownIt, opts: RenderOptions) {
	md.inline.ruler.before('link', 'wikilink', (state: StateInline, silent: boolean) => {
		if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) return false;
		const m = WIKI_AT.exec(state.src.slice(state.pos));
		if (!m) return false;
		if (!silent) {
			const tok = state.push('wikilink', '', 0);
			tok.meta = { id: m[1], alias: m[2] || undefined };
		}
		state.pos += m[0].length;
		return true;
	});
	md.renderer.rules.wikilink = (tokens, idx) => chipHtml(tokens[idx].meta.id, tokens[idx].meta.alias, opts);
}

/** Add `data-line` attributes to block tokens so views can scroll to a source line. */
function lineAttrs(md: MarkdownIt) {
	md.core.ruler.push('line_attrs', (state) => {
		for (const tok of state.tokens) {
			if (tok.map && tok.nesting === 1) tok.attrSet('data-line', String(tok.map[0] + 1));
		}
	});
}

export function createRenderer(opts: RenderOptions = {}) {
	const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
	md.use(wikiPlugin, opts);
	md.use(lineAttrs);
	return md;
}

export function renderMarkdown(src: string, opts: RenderOptions = {}) {
	// Hide HTML guidance comments from SpecNovelist templates.
	return createRenderer(opts).render(src.replace(/<!--[\s\S]*?-->/g, ''));
}
