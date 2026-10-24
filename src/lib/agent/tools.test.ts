import { describe, it, expect } from 'vitest';
import { AGENT_TOOLS } from './tools';

describe('Agent Toolset', () => {
	it('defines all required SpecNovelist agent tools', () => {
		const names = AGENT_TOOLS.map((t) => t.name);
		expect(names).toContain('read_file');
		expect(names).toContain('write_file');
		expect(names).toContain('delete_file');
		expect(names).toContain('list_project_files');
		expect(names).toContain('read_toolkit_doc');
		expect(names).toContain('specnovel');
		expect(names).toContain('fetch_url');
		expect(names).toContain('ask_user');
	});

	it('ask_user tool parameters conform to structured question cards', () => {
		const askUser = AGENT_TOOLS.find((t) => t.name === 'ask_user')!;
		expect(askUser.parameters.required).toContain('questions');
	});
});
