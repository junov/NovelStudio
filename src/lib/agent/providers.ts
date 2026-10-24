/**
 * Unified multi-provider LLM client for Anthropic, OpenAI, and Gemini.
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

export function formatModelLabel(id: string): string {
	const map: Record<string, string> = {
		'gemini-2.5-pro': 'Gemini 2.5 Pro (Flagship)',
		'gemini-2.5-flash': 'Gemini 2.5 Flash (Fast)',
		'gemini-2.0-flash': 'Gemini 2.0 Flash (Fast)',
		'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
		'gemini-1.5-pro': 'Gemini 1.5 Pro',
		'gemini-1.5-flash': 'Gemini 1.5 Flash',
		'gemini-1.5-flash-8b': 'Gemini 1.5 Flash 8B',
		'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet (Flagship)',
		'claude-3-7-sonnet': 'Claude 3.7 Sonnet (Flagship)',
		'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
		'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
		'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku (Fast)',
		'claude-3-5-haiku': 'Claude 3.5 Haiku (Fast)',
		'claude-3-opus-20240229': 'Claude 3 Opus',
		'claude-3-opus': 'Claude 3 Opus',
		'gpt-4o': 'GPT-4o (Flagship)',
		'gpt-4o-mini': 'GPT-4o mini (Fast)',
		'o1': 'o1 (Reasoning)',
		'o3-mini': 'o3-mini (Reasoning)',
		'gpt-4-turbo': 'GPT-4 Turbo'
	};
	if (map[id]) return map[id];
	if (id.startsWith('gemini-2.5-pro')) return 'Gemini 2.5 Pro';
	if (id.startsWith('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
	if (id.startsWith('gemini-2.0-flash-lite')) return 'Gemini 2.0 Flash Lite';
	if (id.startsWith('gemini-2.0-flash')) return 'Gemini 2.0 Flash';
	if (id.startsWith('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet';
	if (id.startsWith('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet';
	if (id.startsWith('claude-3-5-haiku')) return 'Claude 3.5 Haiku';
	return id;
}

// ------------------------------------------------------------------ Anthropic
async function callAnthropic(
	apiKey: string,
	model: string,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDef[]
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

	const res = await httpFetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model,
			system: systemPrompt,
			messages: anthropicMessages,
			tools: anthropicTools.length > 0 ? anthropicTools : undefined,
			max_tokens: 4096
		})
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
	tools: ToolDef[]
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

	const res = await httpFetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			messages: openAiMessages,
			tools: openAiTools.length > 0 ? openAiTools : undefined,
			max_tokens: 4096
		})
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

// ------------------------------------------------------------------ Gemini
async function callGemini(
	apiKey: string,
	model: string,
	messages: ChatMessage[],
	systemPrompt: string,
	tools: ToolDef[]
): Promise<LLMResponse> {
	const httpFetch = await getFetch();

	const functionDeclarations = tools.map((t) => ({
		name: t.name,
		description: t.description,
		parameters: t.parameters
	}));

	const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

	for (const m of messages) {
		if (m.role === 'system') continue;
		if (m.role === 'user') {
			contents.push({ role: 'user', parts: [{ text: m.content || '' }] });
		} else if (m.role === 'assistant') {
			const parts: Array<Record<string, unknown>> = [];
			if (m.content) parts.push({ text: m.content });
			if (m.toolCalls) {
				for (const tc of m.toolCalls) {
					parts.push({
						functionCall: {
							name: tc.name,
							args: tc.args
						}
					});
				}
			}
			contents.push({ role: 'model', parts });
		} else if (m.role === 'tool') {
			let responseObj: unknown;
			try {
				responseObj = JSON.parse(m.content || '{}');
			} catch {
				responseObj = { output: m.content || '' };
			}
			contents.push({
				role: 'user',
				parts: [
					{
						functionResponse: {
							name: m.name || 'tool',
							response: responseObj
						}
					}
				]
			});
		}
	}

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
			toolCalls.push({
				id: `gemini_call_${Math.random().toString(36).slice(2, 9)}`,
				name: part.functionCall.name,
				args: part.functionCall.args || {}
			});
		}
	}

	return {
		text: text || undefined,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
	tools: ToolDef[]
): Promise<LLMResponse> {
	if (!apiKey) {
		throw new Error(`API key for provider '${provider}' is not configured. Please open Settings.`);
	}

	switch (provider) {
		case 'anthropic':
			return callAnthropic(apiKey, model, messages, systemPrompt, tools);
		case 'openai':
			return callOpenAI(apiKey, model, messages, systemPrompt, tools);
		case 'gemini':
			return callGemini(apiKey, model, messages, systemPrompt, tools);
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}

// ------------------------------------------------------------------ Live Model Queries

export const TOP_CANONICAL_MODELS: Record<ProviderId, string[]> = {
	gemini: [
		'gemini-2.5-pro',
		'gemini-2.5-flash',
		'gemini-2.0-flash',
		'gemini-2.0-flash-lite',
		'gemini-1.5-pro',
		'gemini-1.5-flash'
	],
	anthropic: [
		'claude-3-7-sonnet-20250219',
		'claude-3-5-sonnet-20241022',
		'claude-3-5-haiku-20241022',
		'claude-3-opus-20240229'
	],
	openai: [
		'gpt-4o',
		'gpt-4o-mini',
		'o3-mini',
		'o1',
		'gpt-4-turbo'
	]
};

/**
 * Filter and sort a raw list of model IDs down to the top production suggestions
 * known to be available to the user (matching the curated options in Antigravity).
 */
export function filterTopModels(provider: ProviderId, modelIds: string[]): string[] {
	const canonical = TOP_CANONICAL_MODELS[provider] || [];
	const result: string[] = [];

	for (const canon of canonical) {
		if (modelIds.includes(canon)) {
			result.push(canon);
		} else {
			// Prefix match (e.g. preview variants like 'gemini-2.5-pro-preview-03-25')
			const prefix = canon.split('-').slice(0, 3).join('-');
			const match = modelIds.find((id) => id === canon || id.startsWith(`${canon}-`) || id.startsWith(`${prefix}-`));
			if (match && !result.includes(match)) {
				result.push(match);
			}
		}
	}

	// If no exact canonical match occurred (e.g. mock or unexpected IDs), fall back to curated canonical
	if (result.length === 0) {
		return [...canonical];
	}

	return result;
}

async function listAnthropicModels(apiKey: string): Promise<string[]> {
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
	const data = (await res.json()) as { data?: Array<{ id: string }> };
	const raw = (data.data || []).map((m) => m.id);
	return filterTopModels('anthropic', raw);
}

async function listOpenAIModels(apiKey: string): Promise<string[]> {
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
	const data = (await res.json()) as { data?: Array<{ id: string }> };
	const raw = (data.data || []).map((m) => m.id);
	return filterTopModels('openai', raw);
}

async function listGeminiModels(apiKey: string): Promise<string[]> {
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

	const raw = (data.models || [])
		.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
		.map((m) => m.name.replace(/^models\//, ''));

	return filterTopModels('gemini', raw);
}

/**
 * Query the provider's API backend to retrieve top production models available to this account.
 */
export async function fetchAvailableModels(provider: ProviderId, apiKey: string): Promise<string[]> {
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
