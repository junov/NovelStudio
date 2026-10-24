/**
 * App-wide settings persisted with tauri-plugin-store (API keys live in the OS keychain instead).
 * @spec MOD-001, PROJ-002
 */
import { load, type Store } from '@tauri-apps/plugin-store';
import { inTauri } from '$lib/tauri';
import type { DiscoveredModel, ThinkingLevel } from '$lib/agent/providers';

export type ProviderId = 'openai' | 'anthropic' | 'gemini';

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
	proseFontSize: 18
};

class SettingsState {
	value = $state<Settings>(structuredClone(DEFAULTS));
	loaded = $state(false);
	#store: Store | null = null;

	async init() {
		if (this.loaded) return;
		if (inTauri()) {
			this.#store = await load('settings.json', { defaults: {}, autoSave: 200 });
			const saved = (await this.#store.get<Partial<Settings>>('settings')) ?? {};
			this.value = { ...structuredClone(DEFAULTS), ...saved };
		} else {
			const raw = localStorage.getItem('novelstudio.settings');
			if (raw) this.value = { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
		}
		this.loaded = true;
		this.applyTheme();
	}

	async save() {
		const snapshot = $state.snapshot(this.value);
		if (this.#store) await this.#store.set('settings', snapshot);
		else if (typeof localStorage !== 'undefined') {
			localStorage.setItem('novelstudio.settings', JSON.stringify(snapshot));
		}
		this.applyTheme();
	}

	update(patch: Partial<Settings>) {
		this.value = { ...this.value, ...patch };
		void this.save();
	}

	modelFor(stageId: string | undefined): ModelChoice {
		return (stageId && this.value.stageModels[stageId]) || this.value.defaultModel;
	}

	modelsForProvider(provider: ProviderId): DiscoveredModel[] {
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
