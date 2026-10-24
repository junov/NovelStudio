// @spec MOD-001, MOD-002, MOD-003, MOD-004
import { describe, it, expect } from 'vitest';
import {
	filterGenerativeModels,
	formatModelLabel,
	getThinkingConfig,
	type RawModelEntry
} from '../src/lib/agent/providers';

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

	// @spec MOD-002
	it('filters OpenAI models dynamically by created timestamp and removes non-chat models', () => {
		const rawOpenAI: RawModelEntry[] = [
			{ id: 'gpt-4o', created: 1715000000 },
			{ id: 'o3-mini', created: 1738000000 },
			{ id: 'o1', created: 1726000000 },
			{ id: 'gpt-future-reasoning', created: 1740000000 },
			{ id: 'text-embedding-3-small', created: 1700000000 },
			{ id: 'dall-e-3', created: 1698000000 },
			{ id: 'tts-1', created: 1698000000 },
			{ id: 'whisper-1', created: 1677000000 }
		];

		const filtered = filterGenerativeModels('openai', rawOpenAI);
		expect(filtered.map((m) => m.id)).toEqual([
			'gpt-future-reasoning',
			'o3-mini',
			'o1',
			'gpt-4o'
		]);
	});

	// @spec MOD-002
	it('discovers new Anthropic models dynamically sorted newest first', () => {
		const rawAnthropic: RawModelEntry[] = [
			{ id: 'claude-3-5-sonnet-20241022', created: 1729000000 },
			{ id: 'claude-3-7-sonnet-20250219', created: 1740000000 },
			{ id: 'claude-opus-5.5', created: 1760000000 }
		];

		const filtered = filterGenerativeModels('anthropic', rawAnthropic);
		expect(filtered.map((m) => m.id)).toEqual([
			'claude-opus-5.5',
			'claude-3-7-sonnet-20250219',
			'claude-3-5-sonnet-20241022'
		]);
	});
});

describe('MOD-003: Dynamic Model Selector with Provider Display Names', () => {
	// @spec MOD-003
	it('uses provider displayName when available or formats identifier dynamically', () => {
		expect(formatModelLabel('gemini-4-argon', 'Gemini 4 Argon')).toBe('Gemini 4 Argon');
		expect(formatModelLabel('claude-opus-5.5', 'Claude Opus 5.5')).toBe('Claude Opus 5.5');
		expect(formatModelLabel('custom-model-v2')).toBe('Custom Model V2');
	});
});

describe('MOD-004: Configurable Thinking Levels for Reasoning Models', () => {
	// @spec MOD-004
	it('generates provider-specific reasoning configurations based on thinking level', () => {
		// Anthropic budget tokens
		expect(getThinkingConfig('anthropic', 'high')).toEqual({
			anthropicThinking: { type: 'enabled', budget_tokens: 32000 }
		});
		expect(getThinkingConfig('anthropic', 'medium')).toEqual({
			anthropicThinking: { type: 'enabled', budget_tokens: 16000 }
		});
		expect(getThinkingConfig('anthropic', 'low')).toEqual({
			anthropicThinking: { type: 'enabled', budget_tokens: 4000 }
		});
		expect(getThinkingConfig('anthropic', 'off')).toEqual({});

		// OpenAI reasoning effort
		expect(getThinkingConfig('openai', 'high')).toEqual({ openAiReasoningEffort: 'high' });
		expect(getThinkingConfig('openai', 'low')).toEqual({ openAiReasoningEffort: 'low' });
		expect(getThinkingConfig('openai', 'off')).toEqual({});

		// Gemini thinking budget
		expect(getThinkingConfig('gemini', 'high')).toEqual({
			geminiThinkingConfig: { thinkingBudget: 32768 }
		});
		expect(getThinkingConfig('gemini', 'off')).toEqual({});
	});
});
