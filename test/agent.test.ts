// @spec AGT-001, AGT-002, AGT-003, AGT-004
import { describe, it, expect } from 'vitest';
import { AGENT_TOOLS } from '../src/lib/agent/tools';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('AGT-001: Tool Execution Safety and Approval Gate', () => {
	// @spec AGT-001
	it('declares write_file and delete_file tools with path schemas', () => {
		const writeTool = AGENT_TOOLS.find((t) => t.name === 'write_file');
		const deleteTool = AGENT_TOOLS.find((t) => t.name === 'delete_file');
		expect(writeTool).toBeDefined();
		expect(deleteTool).toBeDefined();
		expect(writeTool?.parameters.required).toContain('path');
		expect(writeTool?.parameters.required).toContain('content');
	});
});

describe('AGT-002: Inline Author Interview in Agent Feed', () => {
	// @spec AGT-002
	it('declares ask_user tool with questions schema for inline author interaction', () => {
		const askTool = AGENT_TOOLS.find((t) => t.name === 'ask_user');
		expect(askTool).toBeDefined();
		expect(askTool?.parameters.required).toContain('questions');
	});

	// @spec AGT-002
	it('configures activeQuestion directly in agent engine without external window requirements', () => {
		const engineSource = readFileSync(resolve(__dirname, '../src/lib/agent/engine.svelte.ts'), 'utf-8');
		const askUserCase = engineSource.substring(
			engineSource.indexOf("case 'ask_user':"),
			engineSource.indexOf("default:")
		);
		expect(askUserCase).not.toContain('openInterviewWindow');
		expect(askUserCase).toContain('this.activeQuestion');
	});

	// @spec AGT-002
	it('initializes interview answers synchronously to prevent undefined dereferences during initial render', () => {
		const cardSource = readFileSync(resolve(__dirname, '../src/lib/components/InterviewCard.svelte'), 'utf-8');
		expect(cardSource).toContain('initAnswers');
		expect(cardSource).not.toMatch(/let answers = \$state\((\{\}|<[^>]+>\(\{\}\))\);/);
	});
});

describe('AGT-003: Selectable and Copyable Agent Feed Content', () => {
	// @spec AGT-003
	it('configures user-select: text on panel feed and entry contents', () => {
		const panelSource = readFileSync(resolve(__dirname, '../src/lib/components/AgentPanel.svelte'), 'utf-8');
		expect(panelSource).toContain('.panel-feed');
		expect(panelSource).toContain('user-select: text');
		expect(panelSource).toContain('.entry-content');
	});
});

describe('AGT-004: Drag-Resizable Agent Panel Width', () => {
	// @spec AGT-004
	it('includes a resize handle with col-resize cursor and double-click reset', () => {
		const panelSource = readFileSync(resolve(__dirname, '../src/lib/components/AgentPanel.svelte'), 'utf-8');
		expect(panelSource).toContain('class="resize-handle"');
		expect(panelSource).toContain('cursor: col-resize');
		expect(panelSource).toContain('handleDoubleClick');
	});

	// @spec AGT-004
	it('defines minimum and maximum resize boundaries and localStorage persistence', () => {
		const panelSource = readFileSync(resolve(__dirname, '../src/lib/components/AgentPanel.svelte'), 'utf-8');
		expect(panelSource).toContain('MIN_WIDTH = 280');
		expect(panelSource).toContain('MAX_WIDTH = 800');
		expect(panelSource).toContain('novelstudio.agent_panel_width');
	});
});
