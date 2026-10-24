/**
 * Thin typed wrappers around the Rust commands in `src-tauri/src/lib.rs`.
 */
import { invoke } from '@tauri-apps/api/core';

export interface CmdOutput {
	code: number;
	stdout: string;
	stderr: string;
}

export interface ToolkitInfo {
	toolkit_path: string;
	python_path: string | null;
	python_version: string | null;
	git_version: string | null;
}

export interface FileEntry {
	path: string;
	size: number;
	modified: number;
}

export const toolkitInfo = () => invoke<ToolkitInfo>('toolkit_info');

export const runSpecnovel = (project: string, args: string[]) =>
	invoke<CmdOutput>('run_specnovel', { project, args });

export const runGit = (project: string, args: string[]) =>
	invoke<CmdOutput>('run_git', { project, args });

export const ensureDir = (path: string) => invoke<void>('ensure_dir', { path });

export const pathExists = (project: string, rel: string) =>
	invoke<boolean>('path_exists', { project, rel });

export const readText = (project: string, rel: string) =>
	invoke<string>('read_text', { project, rel });

export const writeText = (project: string, rel: string, content: string) =>
	invoke<void>('write_text', { project, rel, content });

export const deleteFile = (project: string, rel: string) =>
	invoke<void>('delete_file', { project, rel });

export const readToolkit = (rel: string) => invoke<string>('read_toolkit', { rel });

export const readBytes = (project: string, rel: string) =>
	invoke<number[]>('read_bytes', { project, rel });

export const listFiles = (project: string) => invoke<FileEntry[]>('list_files', { project });

export const scanMarkdown = (project: string) =>
	invoke<{ path: string; content: string }[]>('scan_markdown', { project });

export const secretSet = (name: string, value: string) =>
	invoke<void>('secret_set', { name, value });

export const secretGet = (name: string) => invoke<string | null>('secret_get', { name });

export const secretDelete = (name: string) => invoke<void>('secret_delete', { name });

export const openSettingsWindow = async () => {
	if (inTauri()) return invoke<void>('open_settings_window');
};

export const openInterviewWindow = async () => {
	if (inTauri()) return invoke<void>('open_interview_window');
};

export const closeWindow = async (label: string) => {
	if (inTauri()) return invoke<void>('close_window', { label });
};

export const setInterviewPrompt = async (promptJson: string) => {
	if (inTauri()) return invoke<void>('set_interview_prompt', { promptJson });
};

export const getInterviewPrompt = async (): Promise<string | null> => {
	if (inTauri()) return invoke<string | null>('get_interview_prompt');
	return null;
};

export const submitInterviewAnswers = async (answersJson: string) => {
	if (inTauri()) return invoke<void>('submit_interview_answers', { answersJson });
};

export const pollInterviewAnswers = async (): Promise<string | null> => {
	if (inTauri()) return invoke<string | null>('poll_interview_answers');
	return null;
};

/**
 * Open a native system folder picker dialog.
 * When running in Tauri, opens the native OS Explorer dialog.
 * When running in a browser, prompts for a local path.
 */
export async function pickFolder(): Promise<string | null> {
	if (inTauri()) {
		try {
			const res = await invoke<string | null>('pick_folder');
			if (res) return res;
		} catch (e) {
			console.warn('Native pick_folder failed, falling back to plugin:', e);
		}
		try {
			const { open } = await import('@tauri-apps/plugin-dialog');
			const selected = await open({ directory: true, multiple: false });
			return typeof selected === 'string' ? selected : null;
		} catch (e) {
			console.error('Folder picker dialog error:', e);
			return null;
		}
	}
	// Browser fallback
	return prompt('Enter full folder path on your machine (e.g. C:\\Users\\...\\MyNovel):');
}

/** Run a specnovel command with `--json` and parse its stdout. */
export async function specnovelJson<T>(project: string, args: string[]): Promise<T> {
	const out = await runSpecnovel(project, [...args, '--json']);
	try {
		return JSON.parse(out.stdout) as T;
	} catch {
		throw new Error(
			`specnovel ${args.join(' ')} failed (exit ${out.code}): ${out.stderr || out.stdout}`.trim()
		);
	}
}

/** True when running inside the Tauri webview (false in a plain browser / tests). */
export const inTauri = () =>
	typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as object);
