// @spec AGT-001, AGT-002, AGT-003, AGT-004, AGT-005
import { describe, it, expect } from 'vitest';
import { AGENT_TOOLS } from '../src/lib/agent/tools';
import { initAnswers } from '../src/lib/components/InterviewCard.svelte';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { AskUserRequest } from '../src/lib/agent/types';

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

	// @spec AGT-002
	it('does not log confusing placeholder cards and places InterviewCard inline after feed items', () => {
		const engineSource = readFileSync(resolve(__dirname, '../src/lib/agent/engine.svelte.ts'), 'utf-8');
		const panelSource = readFileSync(resolve(__dirname, '../src/lib/components/AgentPanel.svelte'), 'utf-8');

		// Ensure no dummy 'Presenting N question(s)' placeholder feed item is generated
		expect(engineSource).not.toContain('Presenting');

		// Ensure InterviewCard is rendered after the feed loop (inline with latest activity)
		const eachFeedIndex = panelSource.indexOf('{#each agent.feed as item}');
		const interviewCardIndex = panelSource.indexOf('<InterviewCard');
		expect(eachFeedIndex).toBeGreaterThan(-1);
		expect(interviewCardIndex).toBeGreaterThan(eachFeedIndex);

		// Ensure auto-scroll to bring the interview card into view
		expect(panelSource).toContain('scrollTo');
		expect(panelSource).toContain('feedContainer');
	});

	// @spec AGT-002
	it('cleans up activeQuestion and resets status to idle on cancellation', () => {
		const engineSource = readFileSync(resolve(__dirname, '../src/lib/agent/engine.svelte.ts'), 'utf-8');
		const cancelMethod = engineSource.substring(
			engineSource.indexOf('cancel() {'),
			engineSource.indexOf('/** Launch a task or skill */')
		);
		expect(cancelMethod).toContain('this.activeQuestion = null');
		expect(cancelMethod).toContain("this.status = 'idle'");
	});
});

describe('AGT-005: Author Interview Card Schema and Form Controls', () => {
	// @spec AGT-005
	it('pre-selects recommendedIndex option and sets non-skipped initial state', () => {
		const mockRequest: AskUserRequest = {
			id: 'test_req_1',
			title: 'Phase 1: Premise',
			questions: [
				{
					id: 'q1',
					prompt: 'Choose premise',
					options: [
						{ label: 'Option A', description: 'Desc A' },
						{ label: 'Option B (Recommended)', description: 'Desc B' }
					],
					recommendedIndex: 1
				},
				{
					id: 'q2',
					prompt: 'Default choice',
					defaultValue: 'Preset Value'
				}
			],
			resolve: () => {}
		};

		const answers = initAnswers(mockRequest);
		expect(answers['q1']).toEqual({
			selected: ['Option B (Recommended)'],
			text: '',
			skipped: false
		});
		expect(answers['q2']).toEqual({
			selected: ['Preset Value'],
			text: '',
			skipped: false
		});
	});

	// @spec AGT-005
	it('renders markdown guidance, sequential numbering, option pills, and freeform inputs', () => {
		const cardSource = readFileSync(resolve(__dirname, '../src/lib/components/InterviewCard.svelte'), 'utf-8');

		// Sequential question numbering
		expect(cardSource).toContain('Q{i + 1}');

		// Markdown details rendering with wiki-links
		expect(cardSource).toContain('renderMarkdown(q.details)');
		expect(cardSource).toContain('wikiLinks');

		// Option pills with distinct label, description, and indicator
		expect(cardSource).toContain('class="opt-check"');
		expect(cardSource).toContain('class="opt-label"');
		expect(cardSource).toContain('class="opt-desc"');

		// Freeform custom input row
		expect(cardSource).toContain('q.allowFreeform !== false');
		expect(cardSource).toContain('bind:value={answers[q.id].text}');

		// Skip toggle button conditional on allowSkip
		expect(cardSource).toContain('q.allowSkip !== false');
		expect(cardSource).toContain('skipQuestion');

		// Answer packaging on submit
		expect(cardSource).toContain('submitAll');
		expect(cardSource).toContain('questionId: q.id');
		expect(cardSource).toContain('selected: a?.selected');
		expect(cardSource).toContain('text: a?.text?.trim()');
		expect(cardSource).toContain('skipped: a?.skipped');
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
