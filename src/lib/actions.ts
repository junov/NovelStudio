/**
 * Svelte actions shared across views.
 */
import { project } from '$lib/stores/project.svelte';

/**
 * Delegate clicks on `[data-wiki]` chips inside `node` to wiki navigation, and
 * open external links in the system browser.
 */
export function wikiLinks(node: HTMLElement) {
	const onClick = async (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		const chip = target.closest<HTMLElement>('[data-wiki]');
		if (chip) {
			e.preventDefault();
			project.openId(chip.dataset.wiki!);
			return;
		}
		const a = target.closest<HTMLAnchorElement>('a[href]');
		if (a && /^https?:/.test(a.getAttribute('href') || '')) {
			e.preventDefault();
			const { openUrl } = await import('@tauri-apps/plugin-opener');
			await openUrl(a.href);
		}
	};
	node.addEventListener('click', onClick);
	return { destroy: () => node.removeEventListener('click', onClick) };
}
