import { describe, it, expect } from 'vitest';
import { filterTopModels, formatModelLabel, TOP_CANONICAL_MODELS } from './providers';

describe('filterTopModels', () => {
	it('filters Gemini models to only canonical top suggestions', () => {
		// Mock 46 models returned from raw Gemini v1beta/models API
		const rawGemini46 = [
			'gemini-2.5-pro',
			'gemini-2.5-flash',
			'gemini-2.0-flash',
			'gemini-2.0-flash-lite',
			'gemini-1.5-pro',
			'gemini-1.5-flash',
			'gemini-1.5-flash-8b',
			'gemini-1.0-pro-001',
			'gemini-1.0-pro-latest',
			'gemini-1.5-pro-exp-0801',
			'gemini-1.5-flash-exp-0827',
			'text-embedding-004',
			'aqa',
			'imagen-3.0-generate-002',
			'chat-bison-001'
		];

		const filtered = filterTopModels('gemini', rawGemini46);

		// Should match the top canonical suggestions
		expect(filtered).toEqual([
			'gemini-2.5-pro',
			'gemini-2.5-flash',
			'gemini-2.0-flash',
			'gemini-2.0-flash-lite',
			'gemini-1.5-pro',
			'gemini-1.5-flash'
		]);
	});

	it('filters Anthropic models down to top Claude 3.x models', () => {
		const rawAnthropic = [
			'claude-3-7-sonnet-20250219',
			'claude-3-5-sonnet-20241022',
			'claude-3-5-haiku-20241022',
			'claude-3-opus-20240229',
			'claude-2.1',
			'claude-2.0',
			'claude-instant-1.2'
		];

		const filtered = filterTopModels('anthropic', rawAnthropic);
		expect(filtered).toEqual([
			'claude-3-7-sonnet-20250219',
			'claude-3-5-sonnet-20241022',
			'claude-3-5-haiku-20241022',
			'claude-3-opus-20240229'
		]);
	});

	it('filters OpenAI models to top GPT-4o and reasoning models', () => {
		const rawOpenAI = [
			'gpt-4o',
			'gpt-4o-mini',
			'o3-mini',
			'o1',
			'gpt-4-turbo',
			'text-embedding-3-small',
			'dall-e-3',
			'tts-1',
			'whisper-1'
		];

		const filtered = filterTopModels('openai', rawOpenAI);
		expect(filtered).toEqual(['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'gpt-4-turbo']);
	});
});

describe('formatModelLabel', () => {
	it('provides friendly labels for Antigravity-supported models', () => {
		expect(formatModelLabel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro (Flagship)');
		expect(formatModelLabel('gemini-2.0-flash')).toBe('Gemini 2.0 Flash (Fast)');
		expect(formatModelLabel('claude-3-7-sonnet-20250219')).toBe('Claude 3.7 Sonnet (Flagship)');
		expect(formatModelLabel('gpt-4o')).toBe('GPT-4o (Flagship)');
	});
});
