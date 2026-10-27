/**
 * Global Wiki Link Hover state, listeners, and destination preview extraction.
 * @spec BBL-006
 */
import { project } from '$lib/stores/project.svelte';
import { prefixInfo } from '$lib/entities';
import { renderMarkdown } from '$lib/markdown';

export interface EntityPreview {
	id: string;
	title: string;
	path: string;
	prefix: string;
	hue: number;
	icon: string;
	renderedHtml: string;
	isDefined: boolean;
}

const previewCache = new Map<string, EntityPreview>();

export function clearWikiPreviewCache() {
	previewCache.clear();
}

/**
 * Extracts and renders markdown preview of an entity definition.
 * Extracts the definition section from the source file, strips HTML guidance comments,
 * and renders it as markdown.
 * @spec BBL-006
 */
export async function getEntityPreview(id: string): Promise<EntityPreview> {
	if (previewCache.has(id)) {
		return previewCache.get(id)!;
	}

	const info = prefixInfo(id);
	const def = project.defs[id];

	if (!def) {
		const preview: EntityPreview = {
			id,
			title: 'Entity Not Defined',
			path: info.folder ? `${info.folder}/${id}.md` : id,
			prefix: info.label,
			hue: info.hue,
			icon: info.icon,
			renderedHtml: `<p class="missing-notice">No definition found for <code>${id}</code> in this project.</p>`,
			isDefined: false
		};
		previewCache.set(id, preview);
		return preview;
	}

	try {
		const fullText = await project.read(def.path);
		const lines = fullText.split(/\r?\n/);
		const startLine = Math.max(0, (def.line || 1) - 1);
		let endLine = lines.length;

		// Extract content until next heading of same or higher level
		const targetLevel = def.level || 1;
		const nextHeadingRe = new RegExp(`^#{1,${targetLevel}}\\s+`);
		for (let i = startLine + 1; i < lines.length; i++) {
			if (nextHeadingRe.test(lines[i])) {
				endLine = i;
				break;
			}
		}

		let sectionText = lines.slice(startLine, endLine).join('\n');
		// Strip HTML guidance comments from templates
		sectionText = sectionText.replace(/<!--[\s\S]*?-->/g, '').trim();

		const renderedHtml = renderMarkdown(sectionText, {
			titleOf: (refId) => project.titleOf(refId),
			exists: (refId) => project.hasId(refId)
		});

		const preview: EntityPreview = {
			id,
			title: def.title || id,
			path: def.path,
			prefix: info.label,
			hue: info.hue,
			icon: info.icon,
			renderedHtml,
			isDefined: true
		};
		previewCache.set(id, preview);
		return preview;
	} catch (e) {
		const preview: EntityPreview = {
			id,
			title: def.title || id,
			path: def.path,
			prefix: info.label,
			hue: info.hue,
			icon: info.icon,
			renderedHtml: `<p class="error-notice">Failed to load preview: ${e instanceof Error ? e.message : String(e)}</p>`,
			isDefined: true
		};
		return preview;
	}
}

class WikiHoverState {
	active = $state(false);
	id = $state('');
	targetRect = $state<DOMRect | null>(null);
	preview = $state<EntityPreview | null>(null);
	loading = $state(false);

	async show(id: string, rect: DOMRect) {
		this.id = id;
		this.targetRect = rect;
		this.active = true;
		this.loading = true;

		const res = await getEntityPreview(id);
		if (this.id === id && this.active) {
			this.preview = res;
			this.loading = false;
		}
	}

	hide() {
		this.active = false;
		this.id = '';
		this.targetRect = null;
		this.preview = null;
		this.loading = false;
	}
}

export const wikiHover = new WikiHoverState();

let hoverTimer: any = null;
let currentTarget: HTMLElement | null = null;

/**
 * Attaches global hover listeners to detect wiki chips anywhere in the UI.
 * @spec BBL-006
 */
export function setupWikiHoverListeners() {
	if (typeof window === 'undefined') return () => {};

	const onMouseOver = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		const chip = target.closest<HTMLElement>('[data-wiki]');
		if (!chip || !chip.dataset.wiki) return;

		if (currentTarget === chip) return;
		currentTarget = chip;

		clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => {
			if (currentTarget === chip && chip.isConnected) {
				const rect = chip.getBoundingClientRect();
				wikiHover.show(chip.dataset.wiki!, rect);
			}
		}, 120);
	};

	const onMouseOut = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		const chip = target.closest<HTMLElement>('[data-wiki]');
		if (!chip) return;

		const related = (e.relatedTarget as HTMLElement)?.closest<HTMLElement>('[data-wiki]');
		if (related === chip) return;

		currentTarget = null;
		clearTimeout(hoverTimer);
		wikiHover.hide();
	};

	window.addEventListener('mouseover', onMouseOver, { passive: true });
	window.addEventListener('mouseout', onMouseOut, { passive: true });

	return () => {
		window.removeEventListener('mouseover', onMouseOver);
		window.removeEventListener('mouseout', onMouseOut);
		clearTimeout(hoverTimer);
	};
}
