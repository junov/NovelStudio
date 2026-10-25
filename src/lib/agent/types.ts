/**
 * Agent loop, LLM provider, and tool execution types.
 */

export interface ToolDef {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
}

export interface ToolCall {
	id: string;
	name: string;
	args: Record<string, unknown>;
	thoughtSignature?: string;
}

export interface ToolResult {
	callId: string;
	toolName: string;
	output: string;
	isError?: boolean;
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
	role: MessageRole;
	content?: string;
	name?: string;
	toolCallId?: string;
	toolCalls?: ToolCall[];
	geminiParts?: Array<Record<string, unknown>>;
}

export interface LLMResponse {
	text?: string;
	toolCalls?: ToolCall[];
	geminiParts?: Array<Record<string, unknown>>;
	promptTokens?: number;
	completionTokens?: number;
	model: string;
}

export interface ApprovalRequest {
	id: string;
	title: string;
	kind: 'write_file' | 'delete_file' | 'command' | 'other';
	path?: string;
	originalContent?: string;
	newContent?: string;
	command?: string;
	args?: string[];
	resolve: (approved: boolean) => void;
}

export interface QuestionCardOption {
	label: string;
	description?: string;
	isDefault?: boolean;
}

export interface AskUserQuestion {
	id: string;
	prompt: string;
	details?: string;
	options?: QuestionCardOption[];
	allowFreeform?: boolean;
	allowSkip?: boolean;
	defaultValue?: string;
	isMultiSelect?: boolean;
	recommendedIndex?: number;
}

export interface UserAnswer {
	questionId: string;
	selected?: string[];
	text?: string;
	skipped?: boolean;
}

export interface AskUserRequest {
	id: string;
	title?: string;
	questions: AskUserQuestion[];
	resolve: (answers: UserAnswer[]) => void;
}

export type FeedItemType =
	| 'thought'
	| 'tool_start'
	| 'tool_end'
	| 'approval'
	| 'question'
	| 'answer'
	| 'message'
	| 'error'
	| 'sync_baseline';

export interface FeedItem {
	id: string;
	timestamp: number;
	type: FeedItemType;
	title: string;
	content?: string;
	metadata?: Record<string, unknown>;
	status?: 'running' | 'success' | 'warning' | 'error';
}

export type AgentStatus =
	| 'idle'
	| 'running'
	| 'awaiting_approval'
	| 'awaiting_user_input'
	| 'paused'
	| 'completed'
	| 'failed';
