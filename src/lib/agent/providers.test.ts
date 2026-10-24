// @spec MOD-002, MOD-003, MOD-004
import { describe, it, expect } from 'vitest';
import {
	filterGenerativeModels,
	formatModelLabel,
	getThinkingConfig,
	type RawModelEntry
} from './providers';

describe('filterGenerativeModels', () => {
	// @spec MOD-002
	it('filters out non-generative models and preserves arbitrary new models', () => {
		const rawGemini: RawModelEntry[] = [
			{ id: 'gemini-4-argon', displayName: 'Gemini 4 Argon', methods: ['generateContent'] },
			{ id: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', methods: ['generateContent'] },
			{ id: 'text-embedding-004', displayName: 'Embeddings', methods: ['embedContent'] },
			{ id: 'aqa', displayName: 'AQA', methods: ['generateAnswer'] },
			{ id: 'imagen-3.0', displayName: 'Imagen', methods: ['generateImage'] }
		];

		const filtered = filterGenerativeModels('gemini', rawGemini);
		expect(filtered.map((m) => m.id)).toEqual(['gemini-4-argon', 'gemini-3.8-flash']);
	});
});

describe('formatModelLabel', () => {
	// @spec MOD-003
	it('formats model labels cleanly using provider displayName or formatted id', () => {
		expect(formatModelLabel('gemini-4-argon', 'Gemini 4 Argon')).toBe('Gemini 4 Argon');
		expect(formatModelLabel('claude-opus-5.5', 'Claude Opus 5.5')).toBe('Claude Opus 5.5');
		expect(formatModelLabel('my-custom-model')).toBe('My Custom Model');
	});
});

describe('getThinkingConfig', () => {
	// @spec MOD-004
	it('provides valid reasoning payloads for reasoning models', () => {
		expect(getThinkingConfig('openai', 'high')).toEqual({ openAiReasoningEffort: 'high' });
		expect(getThinkingConfig('gemini', 'medium')).toEqual({ geminiThinkingConfig: { thinkingBudget: 16384 } });
		expect(getThinkingConfig('anthropic', 'low')).toEqual({ anthropicThinking: { type: 'enabled', budget_tokens: 4000 } });
		expect(getThinkingConfig('anthropic', 'off')).toEqual({});
	});
});
