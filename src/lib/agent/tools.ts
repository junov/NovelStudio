/**
 * Standard toolset exposed to LLM agents in SpecNovelist workflows.
 */
import type { ToolDef } from './types';

export const AGENT_TOOLS: ToolDef[] = [
	{
		name: 'read_file',
		description: 'Read the text content of a file in the novel project.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Relative path from project root (e.g. "story/synopsis.md", "kb/characters/CHR-001.md").'
				}
			},
			required: ['path']
		}
	},
	{
		name: 'write_file',
		description: 'Create or update a file in the novel project. Replaces existing content.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Relative path from project root (e.g. "story/brief.md").'
				},
				content: {
					type: 'string',
					description: 'Full text content to write.'
				},
				summary: {
					type: 'string',
					description: 'Short 1-line description of the change for review.'
				}
			},
			required: ['path', 'content']
		}
	},
	{
		name: 'delete_file',
		description: 'Delete a file from the novel project.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Relative path to delete.'
				}
			},
			required: ['path']
		}
	},
	{
		name: 'list_project_files',
		description: 'List all files in the novel project.',
		parameters: {
			type: 'object',
			properties: {
				folder: {
					type: 'string',
					description: 'Optional subfolder prefix to filter by (e.g. "kb/", "manuscript/").'
				}
			}
		}
	},
	{
		name: 'read_toolkit_doc',
		description: 'Read an official SpecNovelist reference guide, checklist, or skill manual from the bundled toolkit (e.g. ".agents/skills/novel-init/references/interview-guide.md", "AGENTS.md", "README.md").',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Relative path within the SpecNovelist toolkit.'
				}
			},
			required: ['path']
		}
	},
	{
		name: 'specnovel',
		description: 'Execute a SpecNovelist CLI command (specnovel.py) such as "status", "check", "dag", "impact", "next-id", "delta", "accept", "audit", "stats", "placeholders", "feedback".',
		parameters: {
			type: 'object',
			properties: {
				subcommand: {
					type: 'string',
					description: 'Subcommand name, e.g. "check", "dag", "impact", "next-id", "audit", "accept".'
				},
				args: {
					type: 'array',
					items: { type: 'string' },
					description: 'Arguments to pass (e.g. ["--stage", "abridged"], or ["CHR"]).'
				}
			},
			required: ['subcommand']
		}
	},
	{
		name: 'fetch_url',
		description: 'Fetch and extract the readable text/content of a webpage for authoritative research.',
		parameters: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					description: 'The HTTP/HTTPS URL to fetch.'
				}
			},
			required: ['url']
		}
	},
	{
		// @spec AGT-002, AGT-005
		name: 'ask_user',
		description: 'Interview the author by displaying one or more structured question cards with choices, recommended defaults, or freeform input. Execution pauses until the user responds.',
		parameters: {
			type: 'object',
			properties: {
				title: {
					type: 'string',
					description: 'Optional header for this round of questions (e.g. "Phase 1: Premise & Scope").'
				},
				questions: {
					type: 'array',
					description: 'List of 1 to 4 questions to present together in this round.',
					items: {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								description: 'Unique identifier for this question (e.g. "genre", "target_words").'
							},
							prompt: {
								type: 'string',
								description: 'The question text shown to the author.'
							},
							details: {
								type: 'string',
								description: 'Craft context, definitions, or guidance explaining why this choice matters.'
							},
							options: {
								type: 'array',
								description: 'Selectable options. Prefix recommended default with "(Recommended)".',
								items: {
									type: 'object',
									properties: {
										label: { type: 'string' },
										description: { type: 'string' }
									},
									required: ['label']
								}
							},
							allowFreeform: {
								type: 'boolean',
								description: 'Whether the author can write in their own custom response (default true).'
							},
							allowSkip: {
								type: 'boolean',
								description: 'Whether this item is optional and can be skipped or decided later (default true).'
							},
							isMultiSelect: {
								type: 'boolean',
								description: 'Whether multiple options can be chosen.'
							},
							recommendedIndex: {
								type: 'number',
								description: '0-based index of the recommended option, if any.'
							}
						},
						required: ['id', 'prompt']
					}
				}
			},
			required: ['questions']
		}
	}
];
