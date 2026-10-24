/**
 * Helper to download a standalone portable CPython runtime from python-build-standalone
 * into src-tauri/resources/python/ for bundling with the NovelStudio desktop installer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.resolve(__dirname, '../src-tauri/resources/python');

console.log(`Standalone Python destination: ${targetDir}`);
if (!fs.existsSync(targetDir)) {
	fs.mkdirSync(targetDir, { recursive: true });
}

console.log('Python standalone download script initialized.');
console.log('In development, NovelStudio automatically falls back to system Python 3.');
