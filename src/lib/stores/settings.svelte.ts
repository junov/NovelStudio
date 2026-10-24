/**
 * App-wide settings persisted with tauri-plugin-store (API keys live in the OS keychain instead).
 */
import { load, type Store } from '@tauri-apps/plugin-store';
import { inTauri } from '$lib/tauri';

export type ProviderId = 'openai' | 'anthropic' | 'gemini';

export interface ModelChoice {
	provider: ProviderId;
	model: string;
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
	/** Cached model lists fetched from providers. */
	modelCache: Partial<Record<ProviderId, string[]>>;
	proseFontSize: number;
}

export const PROVIDERS: Record<ProviderId, { label: string; keyName: string; suggested: string[]; keyUrl: string }> = {
	openai: {
		label: 'OpenAI',
		keyName: 'openai_api_key',
		suggested: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
		keyUrl: 'https://platform.openai.com/api-keys'
	},
	anthropic: {
		label: 'Anthropic Claude',
		keyName: 'anthropic_api_key',
		suggested: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
		keyUrl: 'https://console.anthropic.com/settings/keys'
	},
	gemini: {
		label: 'Google Gemini',
		keyName: 'gemini_api_key',
		suggested: ['gemini-2.5-pro', 'gemini-2.5-flash'],
		keyUrl: 'https://aistudio.google.com/apikey'
	}
};

const DEFAULTS: Settings = {
	theme: 'system',
	recentProjects: [],
	defaultModel: { provider: 'anthropic', model: 'claude-sonnet-4-5' },
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
		else localStorage.setItem('novelstudio.settings', JSON.stringify(snapshot));
		this.applyTheme();
	}

	update(patch: Partial<Settings>) {
		this.value = { ...this.value, ...patch };
		void this.save();
	}

	modelFor(stageId: string | undefined): ModelChoice {
		return (stageId && this.value.stageModels[stageId]) || this.value.defaultModel;
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
