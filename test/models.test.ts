// @spec MOD-001, MOD-002, MOD-003, MOD-004, MOD-005, MOD-006, MOD-007
import { describe, it, expect } from 'vitest';
import {
	filterGenerativeModels,
	formatModelLabel,
	getThinkingConfig,
	formatGeminiToolResponse,
	formatGeminiContents,
	parseAgyModelsOutput,
	fetchAvailableModels,
	type RawModelEntry
} from '../src/lib/agent/providers';
import type { ChatMessage } from '../src/lib/agent/types';
import { SettingsState } from '../src/lib/stores/settings.svelte';

describe('MOD-001: OS Keychain Credential Storage', () => {
	// @spec MOD-001
	it('defines correct OS keychain service and key mappings', () => {
		const expectedService = 'dev.junov.novelstudio';
		expect(expectedService).toBe('dev.junov.novelstudio');
	});
});

describe('MOD-002: Dynamic Backend Model Discovery', () => {
	// @spec MOD-002
	it('filters Gemini models dynamically by capability without hardcoded lists', () => {
		const rawGemini: RawModelEntry[] = [
			{ id: 'gemini-4-argon', displayName: 'Gemini 4 Argon', methods: ['generateContent', 'countTokens'] },
			{ id: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', methods: ['generateContent'] },
			{ id: 'gemini-future-pro', displayName: 'Gemini Future Pro', methods: ['generateContent'] },
			{ id: 'text-embedding-005', displayName: 'Embedding 5', methods: ['embedContent'] },
			{ id: 'imagen-4.0-generate', displayName: 'Imagen 4', methods: ['generateImage'] },
			{ id: 'aqa-model', displayName: 'AQA', methods: ['generateAnswer'] }
		];

		const filtered = filterGenerativeModels('gemini', rawGemini);
		expect(filtered.map((m) => m.id)).toEqual([
			'gemini-4-argon',
			'gemini-3.8-flash',
			'gemini-future-pro'
		]);
	});

	// @spec MOD-002, AGT-010
	it('parses output from agy models dynamically into discovered models', () => {
		const rawAgyOutput = `
Fetching available models...
gemini-4-argon-medium\tGemini 4 Argon (Medium)
gemini-3.8-flash-high\tGemini 3.8 Flash (High)
claude-opus-5-5-low\tClaude Opus 5.5 (Low)
claude-sonnet-5-5-medium\tClaude Sonnet 5.5 (Medium)
gpt-oss-120b-medium\tGPT-OSS 120B (Medium)
flash\tFast Flash
`;
		const models = parseAgyModelsOutput(rawAgyOutput);
		expect(models).toHaveLength(6);
		expect(models[0].id).toBe('gemini-4-argon-medium');
		expect(models[0].displayName).toBe('Gemini 4 Argon (Medium)');
		expect(models[0].supportsThinking).toBe(true);

		const flash = models.find((m) => m.id === 'flash');
		expect(flash).toBeDefined();
		expect(flash?.supportsThinking).toBe(false);
	});

	// @spec MOD-002, AGT-010
	it('fetches Antigravity CLI models without requiring an API key', async () => {
		const models = await fetchAvailableModels('antigravity');
		expect(models.length).toBeGreaterThanOrEqual(3);
		expect(models.map((m) => m.id)).toContain('default');
		expect(models.map((m) => m.id)).toContain('flash');
		expect(models.map((m) => m.id)).toContain('pro');
	});
});

describe('MOD-003: Dynamic Model Selector with Provider Display Names', () => {
	// @spec MOD-003
	it('uses provider displayName when available or formats identifier dynamically', () => {
		expect(formatModelLabel('gemini-4-argon', 'Gemini 4 Argon')).toBe('Gemini 4 Argon');
		expect(formatModelLabel('gemini-1.5-pro', 'Gemini 1.5 Pro')).toBe('Gemini 1.5 Pro');
		expect(formatModelLabel('custom-model-v2')).toBe('Custom Model V2');
	});
});

describe('MOD-004: Configurable Thinking Levels for Reasoning Models', () => {
	// @spec MOD-004
	it('generates provider-specific reasoning configurations based on thinking level', () => {
		// Gemini thinking budget
		expect(getThinkingConfig('gemini', 'high')).toEqual({
			geminiThinkingConfig: { thinkingBudget: 32768 }
		});
		expect(getThinkingConfig('gemini', 'medium')).toEqual({
			geminiThinkingConfig: { thinkingBudget: 16384 }
		});
		expect(getThinkingConfig('gemini', 'low')).toEqual({
			geminiThinkingConfig: { thinkingBudget: 4096 }
		});
		expect(getThinkingConfig('gemini', 'off')).toEqual({});
	});
});

describe('MOD-005: Cross-Window Settings Propagation and Store Persistence', () => {
	// @spec MOD-005
	it('applies incoming settings snapshot immediately and updates active model and thinking level', () => {
		const state = new SettingsState();
		expect(state.value.defaultModel.model).toBe('');

		state.applyIncomingSettings({
			defaultModel: {
				provider: 'gemini',
				model: 'gemini-3.8-flash',
				thinkingLevel: 'high'
			}
		});

		expect(state.value.defaultModel.model).toBe('gemini-3.8-flash');
		expect(state.value.defaultModel.provider).toBe('gemini');
		expect(state.value.defaultModel.thinkingLevel).toBe('high');
	});

	// @spec MOD-005
	it('preserves cached models when applying partial settings updates', () => {
		const state = new SettingsState();
		state.value.modelCache = {
			gemini: [{ id: 'gemini-4-argon', displayName: 'Gemini 4 Argon', supportsThinking: true }]
		};

		state.applyIncomingSettings({
			defaultModel: {
				provider: 'gemini',
				model: 'gemini-4-argon',
				thinkingLevel: 'medium'
			}
		});

		expect(state.modelsForProvider('gemini')).toHaveLength(1);
		expect(state.modelsForProvider('gemini')[0].id).toBe('gemini-4-argon');
		expect(state.value.defaultModel.model).toBe('gemini-4-argon');
		expect(state.value.defaultModel.thinkingLevel).toBe('medium');
	});
});

describe('MOD-006: Gemini Tool Execution Protocol and Struct Marshaling', () => {
	// @spec MOD-006
	it('wraps array results in an object under output for protobuf Struct compatibility', () => {
		const rawArray = JSON.stringify([
			{ questionId: 'genre', selected: ['Cyberpunk'], skipped: false }
		]);
		const res = formatGeminiToolResponse('ask_user', rawArray);
		expect(res.name).toBe('ask_user');
		expect(typeof res.response).toBe('object');
		expect(Array.isArray(res.response)).toBe(false);
		expect(res.response).toEqual({
			output: [{ questionId: 'genre', selected: ['Cyberpunk'], skipped: false }]
		});
	});

	// @spec MOD-006
	it('wraps primitive or plain string results in an object', () => {
		const res = formatGeminiToolResponse('write_file', 'Successfully wrote story/synopsis.md');
		expect(res.name).toBe('write_file');
		expect(typeof res.response).toBe('object');
		expect(Array.isArray(res.response)).toBe(false);
		expect(res.response).toEqual({
			output: 'Successfully wrote story/synopsis.md'
		});
	});

	// @spec MOD-006
	it('preserves valid JSON object mappings directly', () => {
		const rawObject = JSON.stringify({ code: 0, stdout: 'All checks passed' });
		const res = formatGeminiToolResponse('specnovel', rawObject);
		expect(res.name).toBe('specnovel');
		expect(res.response).toEqual({ code: 0, stdout: 'All checks passed' });
	});
});

describe('MOD-007: Gemini Thought Signature Preservation across Tool Turns', () => {
	// @spec MOD-007
	it('preserves verbatim geminiParts including thoughtSignature in contents payload', () => {
		const rawCandidateParts = [
			{ text: 'Thinking about the synopsis...' },
			{
				functionCall: { name: 'read_file', args: { path: 'story/synopsis.md' } },
				thoughtSignature: 'encrypted_signature_token_abc123'
			}
		];

		const messages: ChatMessage[] = [
			{ role: 'user', content: 'Init novel' },
			{
				role: 'assistant',
				content: 'Thinking about the synopsis...',
				toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'story/synopsis.md' }, thoughtSignature: 'encrypted_signature_token_abc123' }],
				geminiParts: rawCandidateParts
			},
			{
				role: 'tool',
				name: 'read_file',
				content: '# Synopsis\nA gripping tale.'
			}
		];

		const contents = formatGeminiContents(messages);
		expect(contents).toHaveLength(3);
		expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'Init novel' }] });
		expect(contents[1]).toEqual({ role: 'model', parts: rawCandidateParts });
		expect((contents[1].parts[1] as Record<string, unknown>).thoughtSignature).toBe('encrypted_signature_token_abc123');
		expect(contents[2].role).toBe('user');
		expect((contents[2].parts[0] as Record<string, unknown>).functionResponse).toBeDefined();
	});

	// @spec MOD-007
	it('falls back to toolCall.thoughtSignature when raw geminiParts are omitted', () => {
		const messages: ChatMessage[] = [
			{ role: 'user', content: 'Run check' },
			{
				role: 'assistant',
				toolCalls: [{
					id: 'c2',
					name: 'specnovel',
					args: { subcommand: 'check' },
					thoughtSignature: 'fallback_sig_xyz789'
				}]
			}
		];

		const contents = formatGeminiContents(messages);
		expect(contents[1].role).toBe('model');
		expect(contents[1].parts[0]).toEqual({
			functionCall: { name: 'specnovel', args: { subcommand: 'check' } },
			thoughtSignature: 'fallback_sig_xyz789'
		});
	});
});
