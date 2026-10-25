/**
 * Unified multi-provider LLM client for Anthropic, OpenAI, and Gemini.
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

	if (provider === 'anthropic') {
		const budgetMap = { low: 4000, medium: 16000, high: 32000 };
		return {
			anthropicThinking: {
				type: 'enabled',
				budget_tokens: budgetMap[level] || 16000
			}
		};
	}

	if (provider === 'openai') {
		return { openAiReasoningEffort: level };
	}

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

// ------------------------------------------------------------------ Anthropic
async function callAnthropic(
	apiKey: string,
	model: string,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDef[],
	thinkingLevel?: ThinkingLevel
): Promise<LLMResponse> {
	const httpFetch = await getFetch();

	const anthropicTools = tools.map((t) => ({
		name: t.name,
		description: t.description,
		input_schema: t.parameters
	}));

	const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [];

	for (const m of messages) {
		if (m.role === 'system') continue;
		if (m.role === 'user') {
			anthropicMessages.push({ role: 'user', content: m.content || '' });
		} else if (m.role === 'assistant') {
			if (m.toolCalls && m.toolCalls.length > 0) {
				const content: unknown[] = [];
				if (m.content) {
					content.push({ type: 'text', text: m.content });
				}
				for (const tc of m.toolCalls) {
					content.push({
						type: 'tool_use',
						id: tc.id,
						name: tc.name,
						input: tc.args
					});
				}
				anthropicMessages.push({ role: 'assistant', content });
			} else {
				anthropicMessages.push({ role: 'assistant', content: m.content || '' });
			}
		} else if (m.role === 'tool') {
			anthropicMessages.push({
				role: 'user',
				content: [
					{
						type: 'tool_result',
						tool_use_id: m.toolCallId,
						content: m.content || ''
					}
				]
			});
		}
	}

	const reqBody: Record<string, unknown> = {
		model,
		system: systemPrompt,
		messages: anthropicMessages,
		tools: anthropicTools.length > 0 ? anthropicTools : undefined,
		max_tokens: 4096
	};

	if (thinkingLevel && thinkingLevel !== 'off') {
		const config = getThinkingConfig('anthropic', thinkingLevel) as {
			anthropicThinking?: { type: string; budget_tokens: number };
		};
		if (config.anthropicThinking) {
			reqBody.thinking = config.anthropicThinking;
			reqBody.max_tokens = Math.max(4096, config.anthropicThinking.budget_tokens + 4096);
		}
	}

	const res = await httpFetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify(reqBody)
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Anthropic error (${res.status}): ${errText}`);
	}

	const data = (await res.json()) as {
		content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
		usage?: { input_tokens: number; output_tokens: number };
	};

	let text = '';
	const toolCalls: ToolCall[] = [];

	for (const part of data.content || []) {
		if (part.type === 'text' && part.text) {
			text += part.text;
		} else if (part.type === 'tool_use' && part.id && part.name) {
			toolCalls.push({
				id: part.id,
				name: part.name,
				args: part.input || {}
			});
		}
	}

	return {
		text: text || undefined,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		promptTokens: data.usage?.input_tokens,
		completionTokens: data.usage?.output_tokens,
		model
	};
}

// ------------------------------------------------------------------ OpenAI
async function callOpenAI(
	apiKey: string,
	model: string,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDef[],
	thinkingLevel?: ThinkingLevel
): Promise<LLMResponse> {
	const httpFetch = await getFetch();

	const openAiTools = tools.map((t) => ({
		type: 'function',
		function: {
			name: t.name,
			description: t.description,
			parameters: t.parameters
		}
	}));

	const openAiMessages: Array<Record<string, unknown>> = [];
	if (systemPrompt) {
		openAiMessages.push({ role: 'system', content: systemPrompt });
	}

	for (const m of messages) {
		if (m.role === 'system') continue;
		if (m.role === 'user') {
			openAiMessages.push({ role: 'user', content: m.content || '' });
		} else if (m.role === 'assistant') {
			const obj: Record<string, unknown> = { role: 'assistant', content: m.content || null };
			if (m.toolCalls && m.toolCalls.length > 0) {
				obj.tool_calls = m.toolCalls.map((tc) => ({
					id: tc.id,
					type: 'function',
					function: {
						name: tc.name,
						arguments: JSON.stringify(tc.args)
					}
				}));
			}
			openAiMessages.push(obj);
		} else if (m.role === 'tool') {
			openAiMessages.push({
				role: 'tool',
				tool_call_id: m.toolCallId,
				content: m.content || ''
			});
		}
	}

	const reqBody: Record<string, unknown> = {
		model,
		messages: openAiMessages,
		tools: openAiTools.length > 0 ? openAiTools : undefined,
		max_tokens: 4096
	};

	if (thinkingLevel && thinkingLevel !== 'off') {
		const config = getThinkingConfig('openai', thinkingLevel);
		if (config.openAiReasoningEffort) {
			reqBody.reasoning_effort = config.openAiReasoningEffort;
		}
	}

	const res = await httpFetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify(reqBody)
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`OpenAI error (${res.status}): ${errText}`);
	}

	const data = (await res.json()) as {
		choices: Array<{
			message: {
				content?: string;
				tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
			};
		}>;
		usage?: { prompt_tokens: number; completion_tokens: number };
	};

	const choice = data.choices?.[0]?.message;
	const text = choice?.content || undefined;
	const toolCalls: ToolCall[] = [];

	if (choice?.tool_calls) {
		for (const tc of choice.tool_calls) {
			let parsedArgs = {};
			try {
				parsedArgs = JSON.parse(tc.function.arguments);
			} catch {
				parsedArgs = { raw: tc.function.arguments };
			}
			toolCalls.push({
				id: tc.id,
				name: tc.function.name,
				args: parsedArgs
			});
		}
	}

	return {
		text,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		promptTokens: data.usage?.prompt_tokens,
		completionTokens: data.usage?.completion_tokens,
		model
	};
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
		case 'anthropic':
			return callAnthropic(apiKey, model, messages, systemPrompt, tools, thinkingLevel);
		case 'openai':
			return callOpenAI(apiKey, model, messages, systemPrompt, tools, thinkingLevel);
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

	if (provider === 'anthropic') {
		const sorted = [...models].sort((a, b) => (b.created || 0) - (a.created || 0));
		return sorted.map((m) => ({
			id: m.id,
			displayName: m.displayName || formatModelLabel(m.id),
			supportsThinking: Boolean(
				m.id.includes('opus-5') ||
				m.id.includes('3-7-sonnet') ||
				m.id.includes('thinking')
			)
		}));
	}

	if (provider === 'openai') {
		const nonChatMarkers = ['whisper', 'dall-e', 'tts', 'embedding', 'babbage', 'davinci', 'realtime', 'audio'];
		const filtered = models.filter((m) => {
			const l = m.id.toLowerCase();
			return !nonChatMarkers.some((marker) => l.includes(marker));
		});
		const sorted = [...filtered].sort((a, b) => (b.created || 0) - (a.created || 0));
		return sorted.map((m) => ({
			id: m.id,
			displayName: m.displayName || formatModelLabel(m.id),
			supportsThinking: Boolean(
				m.id.startsWith('o1') ||
				m.id.startsWith('o3') ||
				m.id.includes('reasoning')
			)
		}));
	}

	return models.map((m) => ({ id: m.id, displayName: m.displayName || m.id }));
}

async function listAnthropicModels(apiKey: string): Promise<DiscoveredModel[]> {
	const httpFetch = await getFetch();
	const res = await httpFetch('https://api.anthropic.com/v1/models', {
		method: 'GET',
		headers: {
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		}
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Failed to list Anthropic models (${res.status}): ${err}`);
	}
	const data = (await res.json()) as {
		data?: Array<{ id: string; display_name?: string; created_at?: string }>;
	};
	const raw: RawModelEntry[] = (data.data || []).map((m) => ({
		id: m.id,
		displayName: m.display_name,
		created: m.created_at ? new Date(m.created_at).getTime() / 1000 : 0
	}));
	return filterGenerativeModels('anthropic', raw);
}

async function listOpenAIModels(apiKey: string): Promise<DiscoveredModel[]> {
	const httpFetch = await getFetch();
	const res = await httpFetch('https://api.openai.com/v1/models', {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${apiKey}`
		}
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Failed to list OpenAI models (${res.status}): ${err}`);
	}
	const data = (await res.json()) as { data?: Array<{ id: string; created?: number }> };
	const raw: RawModelEntry[] = (data.data || []).map((m) => ({
		id: m.id,
		created: m.created || 0
	}));
	return filterGenerativeModels('openai', raw);
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
 * Query the provider's API backend to retrieve all available text generation models dynamically.
 * Zero hard-coded model lists; all names originate directly from the service backend.
 */
export async function fetchAvailableModels(provider: ProviderId, apiKey: string): Promise<DiscoveredModel[]> {
	if (!apiKey) return [];
	switch (provider) {
		case 'anthropic':
			return listAnthropicModels(apiKey);
		case 'openai':
			return listOpenAIModels(apiKey);
		case 'gemini':
			return listGeminiModels(apiKey);
		default:
			return [];
	}
}
