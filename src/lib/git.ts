/**
 * Git review and accept flow operations: unstaged status query, commit on accept, revert.
 * @spec REV-001, REV-002, REV-003
 */
import { runGit } from '$lib/tauri';

/**
 * Parse `git status --porcelain` to extract relative paths of unstaged or modified files.
 */
export function parsePorcelainStatus(output: string): Set<string> {
	const files = new Set<string>();
	const lines = output.split('\n');
	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		if (!line || line.length < 3) continue;
		// Format: XY PATH or XY "PATH" or XY OLD -> NEW
		const xy = line.slice(0, 2);
		// Check for unstaged changes in worktree or untracked
		// Porcelain statuses: ' M', ' D', ' A', '??', 'MM', 'AM', etc.
		const isUnstaged = xy[1] !== ' ' || xy === '??' || xy[0] === '?' || xy[0] === 'A' || xy[0] === 'M';
		if (isUnstaged) {
			let pathPart = line.slice(3).trim();
			if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
				pathPart = pathPart.slice(1, -1);
			}
			const path = pathPart.includes(' -> ') ? pathPart.split(' -> ')[1].trim() : pathPart;
			const normalized = path.replace(/\\/g, '/');
			if (normalized && !normalized.endsWith('/') && !normalized.endsWith('.gitkeep')) {
				files.add(normalized);
			}
		}
	}
	return files;
}

/**
 * Query Git for all currently unstaged / modified file paths in the project.
 */
export async function getUnstagedFiles(projectRoot: string): Promise<Set<string>> {
	try {
		const res = await runGit(projectRoot, ['status', '--porcelain', '-uall']);
		if (res.code === 0) {
			return parsePorcelainStatus(res.stdout);
		}
	} catch (e) {
		console.error('Failed to query git status:', e);
	}
	return new Set<string>();
}

/**
 * Retrieve the committed baseline version of a file from Git HEAD.
 */
export async function getHeadFileContent(projectRoot: string, relPath: string): Promise<string> {
	try {
		const normalized = relPath.replace(/\\/g, '/');
		const res = await runGit(projectRoot, ['show', `HEAD:${normalized}`]);
		if (res.code === 0) {
			return res.stdout;
		}
	} catch (e) {
		console.warn(`Could not read HEAD for ${relPath}:`, e);
	}
	return '';
}

/**
 * Accept unstaged changes by staging and committing the file.
 */
export async function acceptGitFile(projectRoot: string, relPath: string): Promise<boolean> {
	try {
		const normalized = relPath.replace(/\\/g, '/');
		const addRes = await runGit(projectRoot, ['add', normalized]);
		if (addRes.code !== 0) return false;
		const commitRes = await runGit(projectRoot, ['commit', '-m', `Accept changes to ${normalized}`]);
		return commitRes.code === 0;
	} catch (e) {
		console.error(`Failed to accept file ${relPath}:`, e);
		return false;
	}
}

/**
 * Revert unstaged changes to a file back to Git HEAD.
 */
export async function revertGitFile(projectRoot: string, relPath: string): Promise<boolean> {
	try {
		const normalized = relPath.replace(/\\/g, '/');
		// Try checkout from HEAD first
		const checkoutRes = await runGit(projectRoot, ['checkout', 'HEAD', '--', normalized]);
		if (checkoutRes.code !== 0) {
			// Untracked file: clean
			await runGit(projectRoot, ['clean', '-f', normalized]);
		}
		return true;
	} catch (e) {
		console.error(`Failed to revert file ${relPath}:`, e);
		return false;
	}
}
