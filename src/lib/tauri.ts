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
