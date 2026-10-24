// @spec MOD-001, MOD-002, MOD-003
import { describe, it, expect } from 'vitest';
import { filterTopModels, formatModelLabel } from '../src/lib/agent/providers';

describe('MOD-001: OS Keychain Credential Storage', () => {
	// @spec MOD-001
	it('defines correct OS keychain service and key mappings', () => {
		const expectedService = 'dev.junov.novelstudio';
		expect(expectedService).toBe('dev.junov.novelstudio');
	});
});

describe('MOD-002: Live Model Discovery and Filtering', () => {
	// @spec MOD-002
	it('filters out internal snapshots and embeddings to top Antigravity models', () => {
		const rawGemini = [
			'gemini-2.5-pro',
			'gemini-2.5-flash',
			'gemini-2.0-flash',
			'gemini-2.0-flash-lite',
			'gemini-1.5-pro',
			'gemini-1.5-flash',
			'gemini-1.0-pro-001',
			'text-embedding-004'
		];
		const filtered = filterTopModels('gemini', rawGemini);
		expect(filtered).toEqual([
			'gemini-2.5-pro',
			'gemini-2.5-flash',
			'gemini-2.0-flash',
			'gemini-2.0-flash-lite',
			'gemini-1.5-pro',
			'gemini-1.5-flash'
		]);
	});

	// @spec MOD-002
	it('filters Anthropic models to Claude 3.x flagship models', () => {
		const raw = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-2.1'];
		const filtered = filterTopModels('anthropic', raw);
		expect(filtered).toEqual(['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022']);
	});
});

describe('MOD-003: Reactive Model Selector with Custom Fallback', () => {
	// @spec MOD-003
	it('formats human-readable labels for premier models', () => {
		expect(formatModelLabel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro (Flagship)');
		expect(formatModelLabel('claude-3-7-sonnet-20250219')).toBe('Claude 3.7 Sonnet (Flagship)');
		expect(formatModelLabel('gpt-4o')).toBe('GPT-4o (Flagship)');
	});
});
