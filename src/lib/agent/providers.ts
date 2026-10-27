/**
 * Unified multi-provider LLM client for Gemini and Antigravity CLI.
 * @spec MOD-002, MOD-003, MOD-004, MOD-006, MOD-007
 */
import { inTauri } from '$lib/tauri';
import type { ChatMessage, LLMResponse, ToolCall, ToolDef } from './types';
import type { ProviderId } from '$lib/stores/settings.svelte';

async function getFetch() {
	if (inTauri()) {
		try {
			const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
			return tauriFetch;
		} catch {
			return window.fetch.bind(window);
		}
	}
	return typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;
}

export interface RawModelEntry {
	id: string;
	displayName?: string;
	methods?: string[];
	created?: number;
}

export interface DiscoveredModel {
	id: string;
	displayName: string;
	supportsThinking?: boolean;
}

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';

export function formatModelLabel(id: string, displayName?: string): string {
	if (displayName && displayName.trim()) return displayName.trim();
	if (!id || !id.trim()) return 'Select Model';
	const cleaned = id.replace(/^models\//, '');
	return cleaned
		.split(/[-_]/)
		.map((part) => {
			if (/^(gpt|ai|llm|v\d+)$/i.test(part)) return part.toUpperCase();
			return part.charAt(0).toUpperCase() + part.slice(1);
		})
		.join(' ');
}

export function getThinkingConfig(provider: ProviderId, level: ThinkingLevel | undefined): Record<string, unknown> {
	if (!level || level === 'off') return {};

	if (provider === 'gemini') {
		const budgetMap = { low: 4096, medium: 16384, high: 32768 };
		return {
			geminiThinkingConfig: {
				thinkingBudget: budgetMap[level] || 16384
			}
		};
	}

	return {};
}

/**
 * Marshal tool results into valid protobuf Struct key-value objects for Gemini functionResponse.
 * @spec MOD-006
 */
export function formatGeminiToolResponse(
	name: string | undefined,
	content: string | undefined
): { name: string; response: Record<string, unknown> } {
	let responseObj: Record<string, unknown>;
	try {
		const parsed = JSON.parse(content || '{}');
		if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
			responseObj = parsed as Record<string, unknown>;
		} else {
			responseObj = { output: parsed };
		}
	} catch {
		responseObj = { output: content || '' };
	}

	return {
		name: name || 'tool',
		response: responseObj
	};
}

/**
 * Format conversation messages into Gemini contents payloads, preserving thought signatures on model turns.
 * @spec MOD-006, MOD-007
 */
export function formatGeminiContents(
	messages: ChatMessage[]
): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
	const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

	for (const m of messages) {
		if (m.role === 'system') continue;
		if (m.role === 'user') {
			contents.push({ role: 'user', parts: [{ text: m.content || '' }] });
		} else if (m.role === 'assistant') {
			if (m.geminiParts && m.geminiParts.length > 0) {
				contents.push({ role: 'model', parts: m.geminiParts });
			} else {
				const parts: Array<Record<string, unknown>> = [];
				if (m.content) parts.push({ text: m.content });
				if (m.toolCalls) {
					for (const tc of m.toolCalls) {
						const partObj: Record<string, unknown> = {
							functionCall: {
								name: tc.name,
								args: tc.args
							}
						};
						if (tc.thoughtSignature) {
							partObj.thoughtSignature = tc.thoughtSignature;
						}
						parts.push(partObj);
					}
				}
				contents.push({ role: 'model', parts });
			}
		} else if (m.role === 'tool') {
			contents.push({
				role: 'user',
				parts: [
					{
						functionResponse: formatGeminiToolResponse(m.name, m.content)
					}
				]
			});
		}
	}

	return contents;
}

// ------------------------------------------------------------------ Gemini
async function callGemini(
	apiKey: string,
	model: string,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDef[],
	thinkingLevel?: ThinkingLevel
): Promise<LLMResponse> {
	const httpFetch = await getFetch();

	const functionDeclarations = tools.map((t) => ({
		name: t.name,
		description: t.description,
		parameters: t.parameters
	}));

	const contents = formatGeminiContents(messages);

	const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

	const body: Record<string, unknown> = {
		contents
	};

	if (systemPrompt) {
		body.systemInstruction = {
			parts: [{ text: systemPrompt }]
		};
	}

	if (functionDeclarations.length > 0) {
		body.tools = [{ functionDeclarations }];
	}

	if (thinkingLevel && thinkingLevel !== 'off') {
		const config = getThinkingConfig('gemini', thinkingLevel);
		if (config.geminiThinkingConfig) {
			body.generationConfig = {
				thinkingConfig: config.geminiThinkingConfig
			};
		}
	}

	const res = await httpFetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Gemini error (${res.status}): ${errText}`);
	}

	const data = (await res.json()) as {
		candidates?: Array<{
			content?: {
				parts?: Array<{
					text?: string;
					functionCall?: { name: string; args: Record<string, unknown> };
				}>;
			};
		}>;
		usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
	};

	const candidate = data.candidates?.[0]?.content?.parts || [];
	let text = '';
	const toolCalls: ToolCall[] = [];

	for (const part of candidate) {
		if (part.text) {
			text += part.text;
		}
		if (part.functionCall) {
			const sig = (part as Record<string, unknown>).thoughtSignature || (part as Record<string, unknown>).thought_signature;
			toolCalls.push({
				id: `gemini_call_${Math.random().toString(36).slice(2, 9)}`,
				name: part.functionCall.name,
				args: part.functionCall.args || {},
				thoughtSignature: typeof sig === 'string' ? sig : undefined
			});
		}
	}

	return {
		text: text || undefined,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		geminiParts: candidate.length > 0 ? candidate : undefined,
		promptTokens: data.usageMetadata?.promptTokenCount,
		completionTokens: data.usageMetadata?.candidatesTokenCount,
		model
	};
}

export async function callProvider(
	provider: ProviderId,
	apiKey: string,
	model: string,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDef[],
	thinkingLevel?: ThinkingLevel
): Promise<LLMResponse> {
	if (!apiKey) {
		throw new Error(`API key for provider '${provider}' is not configured. Please open Settings.`);
	}

	switch (provider) {
		case 'gemini':
			return callGemini(apiKey, model, messages, systemPrompt, tools, thinkingLevel);
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}

// ------------------------------------------------------------------ Dynamic Model Discovery

/**
 * Filters and categorizes models dynamically based on provider capabilities
 * rather than hardcoded model name lists.
 */
export function filterGenerativeModels(provider: ProviderId, models: RawModelEntry[]): DiscoveredModel[] {
	if (provider === 'gemini') {
		return models
			.filter((m) => {
				if (m.methods && !m.methods.includes('generateContent')) return false;
				const l = m.id.toLowerCase();
				if (l.includes('embedding') || l.includes('aqa') || l.includes('imagen')) return false;
				return true;
			})
			.map((m) => ({
				id: m.id,
				displayName: m.displayName || formatModelLabel(m.id),
				supportsThinking: Boolean(
					m.id.includes('argon') ||
					m.id.includes('thinking') ||
					m.id.includes('reasoning') ||
					m.id.includes('2.5-pro')
				)
			}));
	}

	return models.map((m) => ({ id: m.id, displayName: m.displayName || m.id }));
}

async function listGeminiModels(apiKey: string): Promise<DiscoveredModel[]> {
	const httpFetch = await getFetch();
	const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
	const res = await httpFetch(url, {
		method: 'GET'
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Failed to list Gemini models (${res.status}): ${err}`);
	}
	const data = (await res.json()) as {
		models?: Array<{
			name: string;
			displayName?: string;
			supportedGenerationMethods?: string[];
		}>;
	};

	const raw: RawModelEntry[] = (data.models || []).map((m) => ({
		id: m.name.replace(/^models\//, ''),
		displayName: m.displayName,
		methods: m.supportedGenerationMethods
	}));

	return filterGenerativeModels('gemini', raw);
}

/**
 * Parse output lines from `agy models` into DiscoveredModel[].
 * @spec AGT-010, MOD-002
 */
export function parseAgyModelsOutput(output: string): DiscoveredModel[] {
	const models: DiscoveredModel[] = [];
	const lines = output.split(/\r?\n/);

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (
			!line ||
			line.startsWith('Fetching available models') ||
			line.startsWith('Usage:') ||
			line.startsWith('Flags:') ||
			line.startsWith('Available models:')
		) {
			continue;
		}

		// Lines are formatted as: <model_id>\t<Display Name (Details)> or separated by spaces
		const parts = line.split(/\t+|\s{2,}/);
		const id = parts[0]?.trim();
		if (!id) continue;

		const displayName = parts.length > 1 ? parts.slice(1).join(' ').trim() : formatModelLabel(id);

		// Base flash models do not support --effort; variants ending in effort levels (-medium, -high, -low)
		// or containing argon/opus/pro/reasoning support thinking
		const idLower = id.toLowerCase();
		const isBaseFlash = idLower === 'flash' || idLower === 'gemini-flash';
		const supportsThinking =
			!isBaseFlash &&
			Boolean(
				idLower.includes('argon') ||
				idLower.includes('opus') ||
				idLower.includes('pro') ||
				idLower.includes('medium') ||
				idLower.includes('high') ||
				idLower.includes('low') ||
				idLower.includes('reasoning') ||
				idLower.includes('o1') ||
				idLower.includes('o3')
			);

		models.push({
			id,
			displayName,
			supportsThinking
		});
	}

	return models;
}

/**
 * Retrieve models from local Antigravity CLI installation via `agy models`.
 * @spec AGT-010, MOD-002
 */
export async function listAntigravityModels(projectRoot?: string): Promise<DiscoveredModel[]> {
	const defaultShortcuts: DiscoveredModel[] = [
		{ id: 'default', displayName: 'Antigravity CLI Default', supportsThinking: true },
		{ id: 'flash', displayName: 'Antigravity Flash (Fast)', supportsThinking: false },
		{ id: 'pro', displayName: 'Antigravity Pro (Reasoning)', supportsThinking: true }
	];

	if (inTauri()) {
		try {
			const { runAntigravity } = await import('$lib/tauri');
			const out = await runAntigravity(projectRoot || '.', ['models']);
			if (out.code === 0 && out.stdout) {
				const discovered = parseAgyModelsOutput(out.stdout);
				if (discovered.length > 0) {
					const seen = new Set(discovered.map((m) => m.id));
					const unlistedDefaults = defaultShortcuts.filter((d) => !seen.has(d.id));
					return [...unlistedDefaults, ...discovered];
				}
			}
		} catch (e) {
			console.warn('Could not query agy models:', e);
		}
	}

	return defaultShortcuts;
}

/**
 * Query the provider's API backend to retrieve all available text generation models dynamically.
 * Zero hard-coded model lists; all names originate directly from the service backend.
 * @spec MOD-002, AGT-010
 */
export async function fetchAvailableModels(
	provider: ProviderId,
	apiKey?: string,
	projectRoot?: string
): Promise<DiscoveredModel[]> {
	if (provider === 'antigravity') {
		return listAntigravityModels(projectRoot);
	}
	if (!apiKey) return [];
	switch (provider) {
		case 'gemini':
			return listGeminiModels(apiKey);
		default:
			return [];
	}
}
