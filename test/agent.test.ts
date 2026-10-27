// @spec AGT-001, AGT-002, AGT-003, AGT-004, AGT-005, AGT-006, AGT-007, AGT-008, AGT-009, AGT-010
import { describe, it, expect } from 'vitest';
import { AGENT_TOOLS } from '../src/lib/agent/tools';
import { initAnswers } from '../src/lib/components/InterviewCard.svelte';
import { parseAskUserQuestions } from '../src/lib/agent/engine.svelte';
import { groupFeedItems, isWorkItemType } from '../src/lib/agent/feed';
import { routeUserPrompt } from '../src/lib/agent/router';
import { PIPELINE } from '../src/lib/stages';
import { renderMarkdown } from '../src/lib/markdown';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { AskUserRequest, FeedItem } from '../src/lib/agent/types';
import { SettingsState, PROVIDERS } from '../src/lib/stores/settings.svelte';

describe('AGT-001: Unstaged File Execution for Agent Tools', () => {
	// @spec AGT-001
	it('declares write_file and delete_file tools with path schemas', () => {
		const writeTool = AGENT_TOOLS.find((t) => t.name === 'write_file');
		const deleteTool = AGENT_TOOLS.find((t) => t.name === 'delete_file');
		expect(writeTool).toBeDefined();
		expect(deleteTool).toBeDefined();
		expect(writeTool?.parameters.required).toContain('path');
		expect(writeTool?.parameters.required).toContain('content');
	});

	// @spec AGT-001
	it('writes directly to disk as unstaged changes and refreshes git status without blocking feed approval', () => {
		const engineSource = readFileSync(resolve(__dirname, '../src/lib/agent/engine.svelte.ts'), 'utf-8');
		expect(engineSource).toContain('refreshGitStatus');
		const writeCase = engineSource.substring(engineSource.indexOf("case 'write_file'"), engineSource.indexOf("case 'specnovel'"));
		expect(writeCase).not.toContain('awaiting_approval');
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
		const eachFeedIndex = panelSource.indexOf('{#each groupedFeed as group}');
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

	// @spec AGT-002
	it('prevents zero-height flexbox collapse on interview card and feed entries', () => {
		const cardSource = readFileSync(resolve(__dirname, '../src/lib/components/InterviewCard.svelte'), 'utf-8');
		const panelSource = readFileSync(resolve(__dirname, '../src/lib/components/AgentPanel.svelte'), 'utf-8');
		const diffSource = readFileSync(resolve(__dirname, '../src/lib/components/DiffReview.svelte'), 'utf-8');

		expect(cardSource).toContain('flex-shrink: 0;');
		expect(cardSource).toContain('min-height: fit-content;');
		expect(panelSource).toContain('flex-shrink: 0;');
		expect(diffSource).toContain('flex-shrink: 0;');
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
			skipped: false,
			customActive: false
		});
		expect(answers['q2']).toEqual({
			selected: ['Preset Value'],
			text: '',
			skipped: false,
			customActive: true
		});
	});

	// @spec AGT-005
	it('renders markdown guidance, sequential numbering, option pills, and freeform inputs', () => {
		const html = renderMarkdown("In storytelling craft, a **[logline](https://en.wikipedia.org/wiki/Logline)** is a 1–2 sentence summary that answers: *Who is the protagonist, what urgent mission drives them, what antagonistic force opposes them, and what happens if they fail?* In this sci-fi retelling of *Little Red Riding Hood*, we need to anchor Red, the 'Wolf', and 'Grandmother'.");
		expect(html).toContain('https://en.wikipedia.org/wiki/Logline');
		expect(html).toContain('<strong>');

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
		expect(cardSource).toContain('selected: a.selected.length > 0 ? a.selected : undefined');
		expect(cardSource).toContain('text: customText');
		expect(cardSource).toContain('skipped: a.skipped');
	});

	// @spec AGT-005 (Issue #1)
	it('associates freeform input with selection indicator, auto-selection on focus, and grayed out inactive state', () => {
		const cardSource = readFileSync(resolve(__dirname, '../src/lib/components/InterviewCard.svelte'), 'utf-8');

		// Custom option pill rendered with selection indicator
		expect(cardSource).toContain('class="option-pill custom-option-pill"');
		expect(cardSource).toContain('class:selected={isCustomSelected}');
		expect(cardSource).toContain('Custom / Other');

		// Input focus and input handlers trigger custom selection
		expect(cardSource).toContain('onfocus={() => selectCustomOption(q, false)}');
		expect(cardSource).toContain('oninput={() => selectCustomOption(q, false)}');

		// Grayed out inactive text styling when non-custom option is active
		expect(cardSource).toContain('class:muted={!isCustomSelected}');
		expect(cardSource).toContain('.custom-input.muted');
		expect(cardSource).toContain('color: var(--ink-faint)');

		// Deselecting custom when a non-custom option is selected in single-select
		expect(cardSource).toContain('ans.customActive = false;');

		// Omitting custom text on submission when custom option was not active
		expect(cardSource).toContain('const customText = a.customActive && a.text?.trim() ? a.text.trim() : undefined');
	});

	// @spec AGT-005
	it('uses valid HTML phrasing content inside option buttons to avoid parser errors', () => {
		const cardSource = readFileSync(resolve(__dirname, '../src/lib/components/InterviewCard.svelte'), 'utf-8');
		// Valid HTML requires phrasing content inside <button>; <div> inside <button> is prohibited
		expect(cardSource).toContain('<span class="opt-body">');
		expect(cardSource).not.toContain('<div class="opt-body">');
	});

	// @spec AGT-005
	it('defensively normalizes tool arguments with parseAskUserQuestions', () => {
		// Case 1: Standard object array
		const parsedStandard = parseAskUserQuestions({
			questions: [
				{
					id: 'q1',
					prompt: 'Logline',
					options: [{ label: 'Opt 1', description: 'Desc 1' }]
				}
			]
		});
		expect(parsedStandard).toHaveLength(1);
		expect(parsedStandard[0].id).toBe('q1');
		expect(parsedStandard[0].prompt).toBe('Logline');
		expect(parsedStandard[0].options?.[0].label).toBe('Opt 1');

		// Case 2: JSON string encoded questions
		const parsedJsonString = parseAskUserQuestions({
			questions: JSON.stringify([
				{
					prompt: 'What genre?',
					options: ['Cyberpunk', 'Solarpunk']
				}
			])
		});
		expect(parsedJsonString).toHaveLength(1);
		expect(parsedJsonString[0].id).toBe('q_1');
		expect(parsedJsonString[0].prompt).toBe('What genre?');
		expect(parsedJsonString[0].options?.[0].label).toBe('Cyberpunk');
		expect(parsedJsonString[0].options?.[1].label).toBe('Solarpunk');

		// Case 3: Single question at top level
		const parsedSingle = parseAskUserQuestions({
			prompt: 'Standalone question?',
			options: [{ label: 'Yes' }, { label: 'No' }]
		});
		expect(parsedSingle).toHaveLength(1);
		expect(parsedSingle[0].prompt).toBe('Standalone question?');
		expect(parsedSingle[0].id).toBe('q_1');

		// Case 4: Invalid/empty arguments
		expect(parseAskUserQuestions({})).toEqual([]);
		expect(parseAskUserQuestions({ questions: 'invalid json' })).toEqual([]);
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

describe('AGT-006: Grouped Activity Feed Work Cards with In-Progress Indicator', () => {
	// @spec AGT-006 (Issue #2)
	it('clusters consecutive tool_start, tool_end, and thought entries into a work card', () => {
		const sampleFeed: FeedItem[] = [
			{ id: '1', timestamp: 1000, type: 'thought', title: 'Planning next chapter outline' },
			{ id: '2', timestamp: 1010, type: 'tool_start', title: 'Tool: read_file', content: 'path: "outline/ch1.md"' },
			{ id: '3', timestamp: 1020, type: 'tool_end', title: 'Read outline/ch1.md', content: '120 chars' }
		];

		const groups = groupFeedItems(sampleFeed, false);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe('work');
		if (groups[0].kind === 'work') {
			expect(groups[0].items).toHaveLength(3);
			expect(groups[0].isBusy).toBe(false);
		}
	});

	// @spec AGT-006 (Issue #2)
	it('breaks work clusters on milestone items like question and approval', () => {
		const sampleFeed: FeedItem[] = [
			{ id: '1', timestamp: 1000, type: 'thought', title: 'Thinking' },
			{ id: '2', timestamp: 1010, type: 'tool_start', title: 'Tool: read_file' },
			{ id: '3', timestamp: 1020, type: 'question', title: 'Author interview round 1' },
			{ id: '4', timestamp: 1030, type: 'thought', title: 'Resumed after answer' },
			{ id: '5', timestamp: 1040, type: 'tool_start', title: 'Tool: write_file' }
		];

		const groups = groupFeedItems(sampleFeed, false);
		expect(groups).toHaveLength(3);
		expect(groups[0].kind).toBe('work');
		if (groups[0].kind === 'work') {
			expect(groups[0].items).toHaveLength(2);
		}
		expect(groups[1].kind).toBe('item');
		if (groups[1].kind === 'item') {
			expect(groups[1].item.type).toBe('question');
		}
		expect(groups[2].kind).toBe('work');
		if (groups[2].kind === 'work') {
			expect(groups[2].items).toHaveLength(2);
		}
	});

	// @spec AGT-006 (Issue #2)
	it('always renders an active work card at the bottom when agent is busy, even if empty', () => {
		// When feed is empty and agent is running
		const emptyRunning = groupFeedItems([], true);
		expect(emptyRunning).toHaveLength(1);
		expect(emptyRunning[0].kind).toBe('work');
		if (emptyRunning[0].kind === 'work') {
			expect(emptyRunning[0].items).toHaveLength(0);
			expect(emptyRunning[0].isBusy).toBe(true);
		}

		// When feed has items and agent is running
		const feedWithItems: FeedItem[] = [
			{ id: '1', timestamp: 1000, type: 'question', title: 'Answered question' }
		];
		const runningAfterQuestion = groupFeedItems(feedWithItems, true);
		expect(runningAfterQuestion).toHaveLength(2);
		expect(runningAfterQuestion[0].kind).toBe('item');
		expect(runningAfterQuestion[1].kind).toBe('work');
		if (runningAfterQuestion[1].kind === 'work') {
			expect(runningAfterQuestion[1].items).toHaveLength(0);
			expect(runningAfterQuestion[1].isBusy).toBe(true);
		}
	});

	// @spec AGT-006 (Issue #2)
	it('transitions active work card to settled state when busy ends', () => {
		const sampleFeed: FeedItem[] = [
			{ id: '1', timestamp: 1000, type: 'tool_start', title: 'Tool: specnovel' }
		];

		// Busy: isBusy is true
		const busyGroup = groupFeedItems(sampleFeed, true)[0];
		if (busyGroup.kind === 'work') {
			expect(busyGroup.isBusy).toBe(true);
		}

		// Settled: isBusy is false
		const settledGroup = groupFeedItems(sampleFeed, false)[0];
		if (settledGroup.kind === 'work') {
			expect(settledGroup.isBusy).toBe(false);
		}
	});

	// @spec AGT-006 (Issue #2)
	it('implements collapsed-by-default WorkCard with in-progress animation in component source', () => {
		const workCardSource = readFileSync(resolve(__dirname, '../src/lib/components/WorkCard.svelte'), 'utf-8');
		const panelSource = readFileSync(resolve(__dirname, '../src/lib/components/AgentPanel.svelte'), 'utf-8');

		// Uses "work item" / "work items" terminology
		expect(workCardSource).toContain('work item');
		expect(workCardSource).toContain('work items completed');
		expect(workCardSource).not.toContain('background action');

		// Collapsed by default
		expect(workCardSource).toContain('let isExpanded = $state(false);');

		// In-progress animation spinner
		expect(workCardSource).toContain('class="work-spinner"');
		expect(workCardSource).toContain('@keyframes work-spin');
		expect(workCardSource).toContain('class:busy={isBusy}');

		// Settled indicator
		expect(workCardSource).toContain('class="work-icon settled"');

		// Expand/collapse toggle
		expect(workCardSource).toContain('work-toggle-btn');
		expect(workCardSource).toContain('isExpanded ?');

		// AgentPanel integration
		expect(panelSource).toContain('WorkCard');
		expect(panelSource).toContain('groupFeedItems');
		expect(panelSource).toContain('groupedFeed');
	});
});

describe('AGT-007: Interactive Skill Routing for Author Feed Messages', () => {
	// @spec AGT-007
	it('routes Story Bible entities, character details, places, worldbuilding, beats, or directives to novel-feedback', () => {
		expect(routeUserPrompt('Create a new character named Dr. Elena Voss')).toBe('novel-feedback');
		expect(routeUserPrompt('Update [[CHR-001]] to include an allergy')).toBe('novel-feedback');
		expect(routeUserPrompt('Add a secret underground place in the city')).toBe('novel-feedback');
		expect(routeUserPrompt('What if the villain has a change of heart?')).toBe('novel-feedback');
		expect(routeUserPrompt('Establish a world rule for the magic system')).toBe('novel-feedback');
		expect(routeUserPrompt('Update [[BET-004]] and add directive [[DIR-001]]')).toBe('novel-feedback');
	});

	// @spec AGT-007
	it('routes explicit initial stage generation, discovery interview, and drafting requests to novel-generate', () => {
		expect(routeUserPrompt('Run discovery interview for the new project')).toBe('novel-generate');
		expect(routeUserPrompt('Generate the narrative stage')).toBe('novel-generate');
		expect(routeUserPrompt('Formulate research questions for the novel')).toBe('novel-generate');
		expect(routeUserPrompt('Draft the prose for chapter 1')).toBe('novel-generate');
		expect(routeUserPrompt('Write the scene with intense dialogue')).toBe('novel-generate');
		expect(routeUserPrompt('Render prose for manuscript')).toBe('novel-generate');
		expect(routeUserPrompt('Compile the book to epub')).toBe('novel-generate');
	});

	// @spec AGT-007
	it('routes incremental synchronization and pending asset rendering to novel-sync', () => {
		expect(routeUserPrompt('Synchronize the structure stage with upstream changes')).toBe('novel-sync');
		expect(routeUserPrompt('Regenerate impacted scenes in abridged')).toBe('novel-sync');
		expect(routeUserPrompt('Render pending illustrations')).toBe('novel-sync');
	});

	// @spec AGT-007
	it('routes verification and telemetry analysis to novel-verify and novel-analyze', () => {
		expect(routeUserPrompt('Verify consistency across the manuscript')).toBe('novel-verify');
		expect(routeUserPrompt('Check continuity and Chekhov guns')).toBe('novel-verify');
		expect(routeUserPrompt('Audit placeholders in the project')).toBe('novel-verify');
		expect(routeUserPrompt('Analyze the pacing waveform and cadence entropy')).toBe('novel-analyze');
		expect(routeUserPrompt('Generate a developmental report with dialogue ratio')).toBe('novel-analyze');
	});

	// @spec AGT-007
	it('defaults ambiguous or general creative messages to novel-feedback', () => {
		expect(routeUserPrompt('Hello, can you help me?')).toBe('novel-feedback');
		expect(routeUserPrompt('Brainstorm some ideas for the next arc')).toBe('novel-feedback');
		expect(routeUserPrompt('Tell me what you think of this premise')).toBe('novel-feedback');
		expect(routeUserPrompt('')).toBe('novel-feedback');
	});

	// @spec AGT-007
	it('integrates routing in AgentPanel prompt handler', () => {
		const panelSource = readFileSync(resolve(__dirname, '../src/lib/components/AgentPanel.svelte'), 'utf-8');
		expect(panelSource).toContain('routeUserPrompt');
		expect(panelSource).toContain('routeUserPrompt(text)');
	});
});

describe('AGT-008: Journey Rail Pipeline Stages and Story Bible Decoupling', () => {
	// @spec AGT-008
	it('displays the 9 sequential SpecNovelist stages', () => {
		expect(PIPELINE.length).toBe(9);
		const stageIds = PIPELINE.map((s) => s.id);
		expect(stageIds).toEqual([
			'initial',
			'setup',
			'research',
			'world',
			'narrative',
			'structure',
			'abridged',
			'manuscript',
			'publishable'
		]);
		expect(stageIds).not.toContain('bible');
	});

	// @spec AGT-008
	it('JourneyRail component iterates over PIPELINE and resolves novel-generate vs novel-sync', () => {
		const railSource = readFileSync(resolve(__dirname, '../src/lib/components/JourneyRail.svelte'), 'utf-8');
		expect(railSource).toContain('{#each PIPELINE as stage, i}');
		expect(railSource).toContain('resolveStageExecution');
		expect(railSource).not.toContain("id === 'bible'");
	});

	// @spec AGT-008
	it('Story Bible remains accessible in Explorer navigator while decoupled from Journey Rail', () => {
		const explorerSource = readFileSync(resolve(__dirname, '../src/lib/components/Explorer.svelte'), 'utf-8');
		expect(explorerSource).toContain("currentTab === 'bible'");
		expect(explorerSource).toContain('Story Bible');
	});
});

describe('AGT-009: User-Controlled Journey Progression and Stage Isolation (Issue #8)', () => {
	// @spec AGT-009 (Issue #8)
	it('JourneyRail component removes redundant next-action-bar and auto-advance handler', () => {
		const railSource = readFileSync(resolve(__dirname, '../src/lib/components/JourneyRail.svelte'), 'utf-8');
		expect(railSource).not.toContain('next-action-bar');
		expect(railSource).not.toContain('handleNextStepClick');
		expect(railSource).not.toContain('Execute Step');
	});

	// @spec AGT-009
	it('enforces strict stage isolation directive in agent engine operational directives', () => {
		const engineSource = readFileSync(resolve(__dirname, '../src/lib/agent/engine.svelte.ts'), 'utf-8');
		expect(engineSource).toContain('STRICT PROGRESSION GUARDRAIL');
		expect(engineSource).toContain('DO NOT automatically trigger or chain execution into subsequent pipeline stages');
		expect(engineSource).toContain('DO NOT prompt, ask, or suggest to the author to advance or move on to the next pipeline stage');
	});

	// @spec AGT-009
	it('loads bundled 9-stage specnovelist skills in agent engine', () => {
		const agentsSource = readFileSync(resolve(__dirname, '../third_party/specnovelist/AGENTS.md'), 'utf-8');
		expect(agentsSource).toContain('Manual Pipeline Progression');
		expect(agentsSource).toContain('9 stages');

		const generateSource = readFileSync(
			resolve(__dirname, '../third_party/specnovelist/.agents/skills/novel-generate/SKILL.md'),
			'utf-8'
		);
		expect(generateSource).toContain('novel-generate');

		const syncSource = readFileSync(
			resolve(__dirname, '../third_party/specnovelist/.agents/skills/novel-sync/SKILL.md'),
			'utf-8'
		);
		expect(syncSource).toContain('novel-sync');
	});
});

describe('AGT-010: Antigravity CLI Agent Driver Option in Provider Selection', () => {
	// @spec AGT-010
	it('includes Antigravity CLI as a registered provider option with label in PROVIDERS', () => {
		expect(PROVIDERS.antigravity).toBeDefined();
		expect(PROVIDERS.antigravity.label).toBe('Antigravity CLI');
	});

	// @spec AGT-010
	it('defaults Antigravity CLI driver to false and builtin engine in settings store', () => {
		const state = new SettingsState();
		expect(state.value.useAntigravityCli).toBe(false);
		expect(state.value.agentDriver).toBe('builtin');
	});

	// @spec AGT-010
	it('persists and reconciles Antigravity CLI preference upon incoming settings updates', () => {
		const state = new SettingsState();
		state.applyIncomingSettings({ defaultModel: { provider: 'antigravity', model: 'default' } });
		expect(state.value.defaultModel.provider).toBe('antigravity');
		expect(state.value.useAntigravityCli).toBe(true);
		expect(state.value.agentDriver).toBe('antigravity');

		state.applyIncomingSettings({ defaultModel: { provider: 'gemini', model: 'gemini-3.8-flash' } });
		expect(state.value.defaultModel.provider).toBe('gemini');
		expect(state.value.useAntigravityCli).toBe(false);
		expect(state.value.agentDriver).toBe('builtin');
	});

	// @spec AGT-010
	it('renders Antigravity CLI option in the Provider dropdown in SettingsModal component', () => {
		const modalSource = readFileSync(
			resolve(__dirname, '../src/lib/components/SettingsModal.svelte'),
			'utf-8'
		);
		expect(modalSource).toContain('id="default-provider"');
		expect(modalSource).toContain('PROVIDERS');
		expect(modalSource).toContain("p === 'antigravity'");
		expect(modalSource).toContain('settings.value.useAntigravityCli = true');
		expect(modalSource).toContain("settings.value.agentDriver = 'antigravity'");
	});

	// @spec AGT-010
	it('wires Antigravity CLI execution dispatch into agent engine and tauri bridge', () => {
		const engineSource = readFileSync(
			resolve(__dirname, '../src/lib/agent/engine.svelte.ts'),
			'utf-8'
		);
		expect(engineSource).toContain("modelChoice.provider === 'antigravity'");
		expect(engineSource).toContain('useAntigravityCli');
		expect(engineSource).toContain('runAntigravity');
		expect(engineSource).toContain('Antigravity CLI');
		expect(engineSource).toContain("'--print'");
		expect(engineSource).toContain("'--dangerously-skip-permissions'");
		expect(engineSource).toContain("'--output-format'");
		expect(engineSource).toContain("'json'");
		expect(engineSource).toContain("'--conversation'");
		expect(engineSource).toContain("parsed.usage");

		const tauriSource = readFileSync(
			resolve(__dirname, '../src/lib/tauri.ts'),
			'utf-8'
		);
		expect(tauriSource).toContain('runAntigravity');
		expect(tauriSource).toContain('run_antigravity');

		const rustSource = readFileSync(
			resolve(__dirname, '../src-tauri/src/lib.rs'),
			'utf-8'
		);
		expect(rustSource).toContain('run_antigravity');
		expect(rustSource).toContain('find_agy');
	});

	// @spec AGT-010
	it('disables thinking for flash models under Antigravity provider in settings', () => {
		const state = new SettingsState();
		const models = state.modelsForProvider('antigravity');
		const flashModel = models.find((m) => m.id === 'flash');
		expect(flashModel).toBeDefined();
		expect(flashModel?.supportsThinking).toBe(false);
	});

	// @spec AGT-010
	it('enables Fetch Models from Provider for Antigravity CLI without requiring API key', () => {
		const modalSource = readFileSync(
			resolve(__dirname, '../src/lib/components/SettingsModal.svelte'),
			'utf-8'
		);
		expect(modalSource).toContain('Fetch Models from Provider');
		expect(modalSource).toContain("settings.value.defaultModel.provider !== 'antigravity'");
		expect(modalSource).toContain('queryModels(settings.value.defaultModel.provider)');
	});

	// @spec AGT-010
	it('hides the Thinking Level setting in SettingsModal when Antigravity CLI is the active provider', () => {
		const modalSource = readFileSync(
			resolve(__dirname, '../src/lib/components/SettingsModal.svelte'),
			'utf-8'
		);
		const thinkingSection = modalSource.substring(
			modalSource.indexOf("settings.value.defaultModel.provider !== 'antigravity'"),
			modalSource.indexOf('Reading Appearance & Theme')
		);
		expect(thinkingSection).toContain('id="thinking-level"');
		expect(thinkingSection).toContain('Thinking / Reasoning Level');
	});

	// @spec AGT-010
	it('places the Antigravity CLI active driver banner below the provider and model selection widgets', () => {
		const modalSource = readFileSync(
			resolve(__dirname, '../src/lib/components/SettingsModal.svelte'),
			'utf-8'
		);
		const modelSelectIdx = modalSource.indexOf('id="default-model"');
		const bannerIdx = modalSource.indexOf('cli-banner');
		expect(modelSelectIdx).toBeGreaterThan(0);
		expect(bannerIdx).toBeGreaterThan(modelSelectIdx);
	});
});
