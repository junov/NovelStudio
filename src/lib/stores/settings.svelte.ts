/**
 * App-wide settings persisted with tauri-plugin-store (API keys live in the OS keychain instead).
 * @spec MOD-001, MOD-005, PROJ-002, AGT-010
 */
import { load, type Store } from '@tauri-apps/plugin-store';
import { inTauri } from '$lib/tauri';
import type { DiscoveredModel, ThinkingLevel } from '$lib/agent/providers';

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'antigravity';
export type AgentDriver = 'builtin' | 'antigravity';

export interface ModelChoice {
	provider: ProviderId;
	model: string;
	thinkingLevel?: ThinkingLevel;
}

export interface RecentProject {
	path: string;
	title: string;
	opened: number;
}

export interface Settings {
	theme: 'light' | 'dark' | 'system';
	recentProjects: RecentProject[];
	defaultModel: ModelChoice;
	/** Per pipeline-stage overrides (keys are `PIPELINE[].id`). */
	stageModels: Record<string, ModelChoice | undefined>;
	/** Skip per-action approval prompts for agent writes / commands. */
	autoApprove: boolean;
	maxAgentSteps: number;
	/** Cached models fetched dynamically from providers. */
	modelCache: Partial<Record<ProviderId, DiscoveredModel[]>>;
	proseFontSize: number;
	/** Option to drive the agent using the local Antigravity CLI (@spec AGT-010) */
	useAntigravityCli: boolean;
	agentDriver: AgentDriver;
}

export const PROVIDERS: Record<ProviderId, { label: string; keyName: string; keyUrl: string }> = {
	openai: {
		label: 'OpenAI',
		keyName: 'openai_api_key',
		keyUrl: 'https://platform.openai.com/api-keys'
	},
	anthropic: {
		label: 'Anthropic Claude',
		keyName: 'anthropic_api_key',
		keyUrl: 'https://console.anthropic.com/settings/keys'
	},
	gemini: {
		label: 'Google Gemini',
		keyName: 'gemini_api_key',
		keyUrl: 'https://aistudio.google.com/apikey'
	},
	antigravity: {
		label: 'Antigravity CLI',
		keyName: 'antigravity_cli',
		keyUrl: 'https://antigravity.google'
	}
};

const DEFAULTS: Settings = {
	theme: 'system',
	recentProjects: [],
	defaultModel: { provider: 'gemini', model: '', thinkingLevel: 'off' },
	stageModels: {},
	autoApprove: false,
	maxAgentSteps: 80,
	modelCache: {},
	proseFontSize: 18,
	useAntigravityCli: false,
	agentDriver: 'builtin'
};

export class SettingsState {
	value = $state<Settings>(structuredClone(DEFAULTS));
	loaded = $state(false);
	#store: Store | null = null;
	#unlisten: (() => void) | null = null;

	async init() {
		if (this.loaded) return;
		if (inTauri()) {
			this.#store = await load('settings.json', { defaults: {}, autoSave: 200 });
			const saved = (await this.#store.get<Partial<Settings>>('settings')) ?? {};
			this.applyIncomingSettings(saved);

			try {
				const { listen } = await import('@tauri-apps/api/event');
				this.#unlisten = await listen<Settings>('novelstudio:settings-changed', (event) => {
					if (event.payload) {
						this.applyIncomingSettings(event.payload);
					}
				});
			} catch (e) {
				console.warn('Could not listen for settings events:', e);
			}
		} else {
			const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('novelstudio.settings') : null;
			if (raw) {
				try {
					this.applyIncomingSettings(JSON.parse(raw));
				} catch {}
			}

			if (typeof window !== 'undefined') {
				window.addEventListener('storage', (e) => {
					if (e.key === 'novelstudio.settings' && e.newValue) {
						try {
							this.applyIncomingSettings(JSON.parse(e.newValue));
						} catch {}
					}
				});
			}
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('focus', () => {
				void this.reload();
			});
		}

		this.loaded = true;
		this.applyTheme();
	}

	applyIncomingSettings(patch: Partial<Settings>) {
		const targetProvider = patch.defaultModel?.provider ?? this.value?.defaultModel?.provider ?? DEFAULTS.defaultModel.provider;
		const isAg = targetProvider === 'antigravity' || Boolean(patch.useAntigravityCli) || patch.agentDriver === 'antigravity';

		const useCli =
			patch.useAntigravityCli ??
			(patch.agentDriver ? patch.agentDriver === 'antigravity' : isAg);
		const driver: AgentDriver =
			patch.agentDriver ??
			(useCli ? 'antigravity' : 'builtin');

		this.value = {
			...structuredClone(DEFAULTS),
			...this.value,
			...patch,
			useAntigravityCli: Boolean(useCli),
			agentDriver: driver,
			defaultModel: {
				...DEFAULTS.defaultModel,
				...(this.value?.defaultModel || {}),
				...(patch.defaultModel || {})
			}
		};
		if (this.value.useAntigravityCli && this.value.defaultModel.provider !== 'antigravity') {
			this.value.defaultModel.provider = 'antigravity';
		}
		if (this.value.defaultModel.provider === 'antigravity' && !this.value.defaultModel.model) {
			this.value.defaultModel.model = 'default';
		}
		this.applyTheme();
	}

	async reload() {
		if (this.#store) {
			try {
				await this.#store.reload();
				const saved = (await this.#store.get<Partial<Settings>>('settings')) ?? {};
				this.applyIncomingSettings(saved);
			} catch (e) {
				console.warn('Could not reload store:', e);
			}
		} else if (typeof localStorage !== 'undefined') {
			const raw = localStorage.getItem('novelstudio.settings');
			if (raw) {
				try {
					this.applyIncomingSettings(JSON.parse(raw));
				} catch {}
			}
		}
	}

	async save() {
		const snapshot = $state.snapshot(this.value);
		if (this.#store) {
			await this.#store.set('settings', snapshot);
			await this.#store.save();
		} else if (typeof localStorage !== 'undefined') {
			localStorage.setItem('novelstudio.settings', JSON.stringify(snapshot));
		}
		this.applyTheme();

		if (inTauri()) {
			try {
				const { emit } = await import('@tauri-apps/api/event');
				await emit('novelstudio:settings-changed', snapshot);
			} catch (e) {
				console.warn('Could not emit settings event:', e);
			}
		} else if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('novelstudio:settings-changed', { detail: snapshot }));
		}
	}

	update(patch: Partial<Settings>) {
		this.value = { ...this.value, ...patch };
		void this.save();
	}

	modelFor(stageId: string | undefined): ModelChoice {
		return (stageId && this.value.stageModels[stageId]) || this.value.defaultModel;
	}

	modelsForProvider(provider: ProviderId): DiscoveredModel[] {
		if (provider === 'antigravity') {
			return (
				this.value.modelCache['antigravity'] || [
					{ id: 'default', displayName: 'Antigravity CLI Default' },
					{ id: 'flash', displayName: 'Antigravity Flash' },
					{ id: 'pro', displayName: 'Antigravity Pro' }
				]
			);
		}
		return this.value.modelCache[provider] || [];
	}

	updateModelCache(provider: ProviderId, models: DiscoveredModel[]) {
		this.value.modelCache = {
			...this.value.modelCache,
			[provider]: models
		};
		void this.save();
	}

	addRecent(path: string, title: string) {
		const rest = this.value.recentProjects.filter((p) => p.path !== path);
		this.update({ recentProjects: [{ path, title, opened: Date.now() }, ...rest].slice(0, 12) });
	}

	removeRecent(path: string) {
		this.update({ recentProjects: this.value.recentProjects.filter((p) => p.path !== path) });
	}

	applyTheme() {
		if (typeof document === 'undefined') return;
		const t = this.value.theme;
		const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
		document.documentElement.style.setProperty('--prose-size', `${this.value.proseFontSize}px`);
	}
}

export const settings = new SettingsState();
