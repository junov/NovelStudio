/**
 * The core SpecNovelist agent execution loop.
 * @spec AGT-001, AGT-002
 */
import {
	readText,
	writeText,
	deleteFile,
	listFiles,
	readToolkit,
	runSpecnovel,
	secretGet,
	inTauri
} from '$lib/tauri';
import { project } from '$lib/stores/project.svelte';
import { settings, PROVIDERS, type ModelChoice } from '$lib/stores/settings.svelte';
import { AGENT_TOOLS } from './tools';
import { callProvider } from './providers';
import type {
	AgentStatus,
	ApprovalRequest,
	AskUserQuestion,
	AskUserRequest,
	ChatMessage,
	FeedItem,
	ToolCall,
	ToolResult,
	UserAnswer
} from './types';

function cleanHtmlText(html: string): string {
	return html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 15000);
}

class AgentEngine {
	status = $state<AgentStatus>('idle');
	feed = $state<FeedItem[]>([]);
	activeApproval = $state<ApprovalRequest | null>(null);
	activeQuestion = $state<AskUserRequest | null>(null);
	currentSkill = $state<string | null>(null);
	currentStep = $state(0);
	totalPromptTokens = $state(0);
	totalCompletionTokens = $state(0);

	#abortController: AbortController | null = null;
	#messages: ChatMessage[] = [];

	addFeed(type: FeedItem['type'], title: string, content?: string, metadata?: Record<string, unknown>, status?: FeedItem['status']) {
		const item: FeedItem = {
			id: `feed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
			timestamp: Date.now(),
			type,
			title,
			content,
			metadata,
			status
		};
		this.feed = [...this.feed, item];
		return item;
	}

	updateLastFeed(patch: Partial<FeedItem>) {
		if (this.feed.length === 0) return;
		const last = { ...this.feed[this.feed.length - 1], ...patch };
		this.feed = [...this.feed.slice(0, -1), last];
	}

	clearFeed() {
		this.feed = [];
		this.currentStep = 0;
		this.totalPromptTokens = 0;
		this.totalCompletionTokens = 0;
	}

	cancel() {
		if (this.#abortController) {
			this.#abortController.abort();
			this.#abortController = null;
		}
		if (this.activeApproval) {
			this.activeApproval.resolve(false);
			this.activeApproval = null;
		}
		if (this.activeQuestion) {
			this.activeQuestion.resolve([]);
			this.activeQuestion = null;
		}
		this.status = 'idle';
		this.addFeed('message', 'Agent execution canceled by user.', undefined, undefined, 'warning');
	}

	/** Launch a task or skill */
	async run(skillName: string, userInstruction: string, stageId?: string) {
		if (!project.root) {
			throw new Error('No project is open');
		}
		if (this.status === 'running') {
			throw new Error('Agent is already running');
		}

		this.status = 'running';
		this.currentSkill = skillName;
		this.currentStep = 0;
		this.#abortController = new AbortController();

		const modelChoice: ModelChoice = settings.modelFor(stageId);
		const providerMeta = PROVIDERS[modelChoice.provider];
		const apiKey = (await secretGet(providerMeta.keyName)) || '';

		if (!apiKey) {
			this.status = 'failed';
			this.addFeed(
				'error',
				`Missing API key for ${providerMeta.label}`,
				`Please add your API key in Settings to run AI tasks.`,
				undefined,
				'error'
			);
			return;
		}

		this.addFeed(
			'message',
			`Starting ${skillName}`,
			`Model: ${modelChoice.provider} / ${modelChoice.model}\nInstruction: ${userInstruction}`
		);

		try {
			// 1. Build System Prompt
			const systemPrompt = await this.#buildSystemPrompt(skillName, modelChoice.model);

			// 2. Initialize messages
			this.#messages = [
				{
					role: 'user',
					content: userInstruction
				}
			];

			const maxSteps = settings.value.maxAgentSteps || 80;

			while (this.currentStep < maxSteps) {
				if (this.#abortController?.signal.aborted) break;

				this.currentStep++;

				// LLM Call
				const response = await callProvider(
					modelChoice.provider,
					apiKey,
					modelChoice.model,
					this.#messages,
					systemPrompt,
					AGENT_TOOLS,
					modelChoice.thinkingLevel
				);

				if (response.promptTokens) this.totalPromptTokens += response.promptTokens;
				if (response.completionTokens) this.totalCompletionTokens += response.completionTokens;

				if (response.text) {
					this.addFeed('thought', 'Agent reasoning', response.text);
				}

				// If no tool calls, agent has completed its response turn
				if (!response.toolCalls || response.toolCalls.length === 0) {
					this.#messages.push({
						role: 'assistant',
						content: response.text
					});
					this.status = 'completed';
					this.addFeed('message', `${skillName} completed`, undefined, undefined, 'success');
					await project.refresh();
					return;
				}

				// Record assistant tool calls in message history
				this.#messages.push({
					role: 'assistant',
					content: response.text,
					toolCalls: response.toolCalls
				});

				// Execute tool calls
				for (const tc of response.toolCalls) {
					if (this.#abortController?.signal.aborted) break;

					const res = await this.#executeTool(tc, modelChoice.model);
					this.#messages.push({
						role: 'tool',
						toolCallId: tc.id,
						name: tc.name,
						content: res.output
					});
				}
			}

			if (this.currentStep >= maxSteps) {
				this.status = 'completed';
				this.addFeed(
					'message',
					'Reached maximum step limit',
					`Completed ${maxSteps} iterations.`,
					undefined,
					'warning'
				);
			}
		} catch (err) {
			this.status = 'failed';
			const msg = err instanceof Error ? err.message : String(err);
			this.addFeed('error', 'Agent execution failed', msg, undefined, 'error');
		} finally {
			await project.refresh();
			if (this.status === 'running') this.status = 'idle';
		}
	}

	async #buildSystemPrompt(skillName: string, modelName: string): Promise<string> {
		let agentsMd = '';
		let skillMd = '';
		try {
			agentsMd = await readToolkit('AGENTS.md');
		} catch {
			agentsMd = 'Follow standard SpecNovelist specifications and formatting.';
		}

		try {
			skillMd = await readToolkit(`.agents/skills/${skillName}/SKILL.md`);
		} catch {
			skillMd = `Execute task according to ${skillName}.`;
		}

		return `You are NovelStudio's embedded AI novelist assistant operating in project root "${project.root}".
You strictly adhere to the SpecNovelist specification-driven novel writing methodology.

=== CURRENT PROJECT STATE ===
Title: ${project.title}
Status Overview:
${project.status ? JSON.stringify(project.status, null, 2) : 'No status available'}

=== SPECNOVELIST GLOBAL RULES (AGENTS.md) ===
${agentsMd}

=== ACTIVE SKILL SPECIFICATION (${skillName}) ===
${skillMd}

=== OPERATIONAL DIRECTIVES ===
1. ALWAYS use the "ask_user" tool when gathering author decisions, options, genre, tone, or style choices during discovery or writing. Structure your questions with helpful craft scaffolding and recommended defaults.
2. DO NOT hallucinate facts: use "fetch_url" or "read_toolkit_doc" to verify historical or craft details.
3. Every cataloged entity must have a permanent uppercase ID (CHR-xxx, PLC-xxx, FCT-xxx, etc.) and be cross-referenced using wiki-links [[ID]].
4. When writing files, write complete, valid markdown files conforming to SpecNovelist templates.
5. When accepting baselines via the "specnovel" tool ("subcommand": "accept"), ALWAYS provide "--model" with "${modelName}".
`;
	}

	async #executeTool(tc: ToolCall, currentModelName: string): Promise<ToolResult> {
		this.addFeed('tool_start', `Tool: ${tc.name}`, JSON.stringify(tc.args, null, 2));

		try {
			switch (tc.name) {
				case 'read_file': {
					const path = String(tc.args.path);
					const content = await readText(project.root!, path);
					this.addFeed('tool_end', `Read ${path}`, `${content.length} characters`, undefined, 'success');
					return { callId: tc.id, toolName: tc.name, output: content };
				}

				case 'write_file': {
					const path = String(tc.args.path);
					const content = String(tc.args.content);
					const summary = tc.args.summary ? String(tc.args.summary) : undefined;

					// Check existing content for diff preview
					let originalContent = '';
					try {
						originalContent = await readText(project.root!, path);
					} catch {
						originalContent = '';
					}

					// Approval gate
					if (!settings.value.autoApprove) {
						this.status = 'awaiting_approval';
						const approved = await new Promise<boolean>((resolve) => {
							this.activeApproval = {
								id: tc.id,
								title: `Write file: ${path}`,
								kind: 'write_file',
								path,
								originalContent,
								newContent: content,
								resolve: (res) => {
									this.activeApproval = null;
									this.status = 'running';
									resolve(res);
								}
							};
							this.addFeed('approval', `Awaiting approval to write ${path}`, summary);
						});

						if (!approved) {
							this.addFeed('tool_end', `Rejected write to ${path}`, undefined, undefined, 'warning');
							return {
								callId: tc.id,
								toolName: tc.name,
								output: `User declined writing to file ${path}.`,
								isError: true
							};
						}
					}

					await writeText(project.root!, path, content);
					await project.refresh();
					this.addFeed('tool_end', `Wrote ${path}`, summary || `${content.length} chars written`, undefined, 'success');
					return { callId: tc.id, toolName: tc.name, output: `Successfully wrote ${path}` };
				}

				case 'delete_file': {
					const path = String(tc.args.path);
					if (!settings.value.autoApprove) {
						this.status = 'awaiting_approval';
						const approved = await new Promise<boolean>((resolve) => {
							this.activeApproval = {
								id: tc.id,
								title: `Delete file: ${path}`,
								kind: 'delete_file',
								path,
								resolve: (res) => {
									this.activeApproval = null;
									this.status = 'running';
									resolve(res);
								}
							};
						});
						if (!approved) {
							return { callId: tc.id, toolName: tc.name, output: `User declined deleting ${path}.`, isError: true };
						}
					}
					await deleteFile(project.root!, path);
					await project.refresh();
					this.addFeed('tool_end', `Deleted ${path}`, undefined, undefined, 'success');
					return { callId: tc.id, toolName: tc.name, output: `Deleted ${path}` };
				}

				case 'list_project_files': {
					const files = await listFiles(project.root!);
					const filter = tc.args.folder ? String(tc.args.folder) : '';
					const filtered = files
						.filter((f) => !filter || f.path.startsWith(filter))
						.map((f) => f.path);
					this.addFeed('tool_end', `Listed files`, `${filtered.length} files found`, undefined, 'success');
					return { callId: tc.id, toolName: tc.name, output: JSON.stringify(filtered, null, 2) };
				}

				case 'read_toolkit_doc': {
					const path = String(tc.args.path);
					const content = await readToolkit(path);
					this.addFeed('tool_end', `Read toolkit doc: ${path}`, `${content.length} characters`, undefined, 'success');
					return { callId: tc.id, toolName: tc.name, output: content };
				}

				case 'specnovel': {
					const sub = String(tc.args.subcommand);
					const rawArgs = Array.isArray(tc.args.args) ? (tc.args.args as string[]) : [];

					// Inject model attribution automatically if accept command
					const finalArgs = [sub, ...rawArgs];
					if (sub === 'accept' && !finalArgs.includes('--model') && currentModelName) {
						finalArgs.push('--model', currentModelName);
					}

					if (!settings.value.autoApprove && sub === 'accept') {
						this.status = 'awaiting_approval';
						const approved = await new Promise<boolean>((resolve) => {
							this.activeApproval = {
								id: tc.id,
								title: `Record baseline sync (specnovel accept)`,
								kind: 'command',
								command: `specnovel ${finalArgs.join(' ')}`,
								resolve: (res) => {
									this.activeApproval = null;
									this.status = 'running';
									resolve(res);
								}
							};
						});
						if (!approved) {
							return { callId: tc.id, toolName: tc.name, output: 'User canceled baseline accept.', isError: true };
						}
					}

					const out = await runSpecnovel(project.root!, finalArgs);
					const text = out.stdout + (out.stderr ? `\n[stderr]\n${out.stderr}` : '');
					this.addFeed('tool_end', `specnovel ${sub}`, text.slice(0, 1000), undefined, out.code === 0 ? 'success' : 'error');
					return {
						callId: tc.id,
						toolName: tc.name,
						output: text || `(Exit ${out.code})`,
						isError: out.code !== 0
					};
				}

				case 'fetch_url': {
					const url = String(tc.args.url);
					let text = '';
					if (inTauri()) {
						const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
						const res = await tauriFetch(url);
						text = await res.text();
					} else {
						const res = await fetch(url);
						text = await res.text();
					}
					const cleaned = cleanHtmlText(text);
					this.addFeed('tool_end', `Fetched ${url}`, `${cleaned.length} characters extracted`, undefined, 'success');
					return { callId: tc.id, toolName: tc.name, output: cleaned };
				}

				case 'ask_user': {
					// @spec AGT-002
					const rawQuestions = (tc.args.questions as AskUserQuestion[]) || [];
					const title = tc.args.title ? String(tc.args.title) : 'Author Interview';

					this.status = 'awaiting_user_input';
					this.addFeed('question', title, `Presenting ${rawQuestions.length} question(s) to author.`);

					const answers = await new Promise<UserAnswer[]>((resolve) => {
						this.activeQuestion = {
							id: tc.id,
							title,
							questions: rawQuestions,
							resolve: (ans: UserAnswer[]) => {
								this.activeQuestion = null;
								this.status = 'running';
								resolve(ans);
							}
						};
					});

					const summaryAnswers = answers
						.map((a) => {
							if (a.skipped) return `[${a.questionId}]: Skipped`;
							const parts = [];
							if (a.selected && a.selected.length > 0) parts.push(a.selected.join(', '));
							if (a.text) parts.push(a.text);
							return `[${a.questionId}]: ${parts.join(' - ')}`;
						})
						.join('\n');

					this.addFeed('answer', 'Author responses', summaryAnswers, undefined, 'success');

					return {
						callId: tc.id,
						toolName: tc.name,
						output: JSON.stringify(answers, null, 2)
					};
				}

				default:
					return {
						callId: tc.id,
						toolName: tc.name,
						output: `Unknown tool: ${tc.name}`,
						isError: true
					};
			}
		} catch (e) {
			const errText = e instanceof Error ? e.message : String(e);
			this.addFeed('tool_end', `Tool failed: ${tc.name}`, errText, undefined, 'error');
			return {
				callId: tc.id,
				toolName: tc.name,
				output: `Error executing ${tc.name}: ${errText}`,
				isError: true
			};
		}
	}
}

export const agent = new AgentEngine();
