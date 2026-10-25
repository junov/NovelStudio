// @spec EDT-001, EDT-002
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { renderMarkdown } from '../src/lib/markdown';
import {
	isGraphic,
	isRasterImage,
	isBinary,
	isEditable,
	getMimeType,
	getFileExtension
} from '../src/lib/formats';

describe('EDT-001: Document Editor with Edit and Preview Modes', () => {
	const editorSrc = readFileSync(resolve(__dirname, '../src/lib/components/Editor.svelte'), 'utf-8');

	// @spec EDT-001
	it('presents toggle controls with eye icon for preview mode and pencil icon for edit mode', () => {
		// Eye icon for preview mode
		expect(editorSrc).toMatch(/👁/);
		// Pencil icon for edit mode
		expect(editorSrc).toMatch(/✏/);
		// Mode state typed for preview and edit
		expect(editorSrc).toMatch(/mode\s*=\s*\$state<'preview'\s*\|\s*'edit'>/);
	});

	// @spec EDT-001
	it('completely excludes WYSIWYG mode and rich text TipTap editor', () => {
		// No WYSIWYG button text or mode
		expect(editorSrc).not.toContain('WYSIWYG');
		expect(editorSrc).not.toContain("'rich'");
		// No TipTap dependencies or wrappers
		expect(editorSrc).not.toContain('@tiptap');
		expect(editorSrc).not.toContain('tiptap-wrapper');
		expect(editorSrc).not.toContain('tiptapEditor');
	});

	// @spec EDT-001
	it('provides CodeMirror 6 editor when in edit mode', () => {
		expect(editorSrc).toContain('codemirror');
		expect(editorSrc).toContain('codemirror-wrapper');
		expect(editorSrc).toContain("mode === 'edit'");
	});

	// @spec EDT-001
	it('renders markdown with interactive wiki-links in preview mode', () => {
		expect(editorSrc).toContain("mode === 'preview'");
		expect(editorSrc).toContain('renderMarkdown');
		expect(editorSrc).toContain('use:wikiLinks');

		const rendered = renderMarkdown('## CHR-001: Elena\nFriend of [[CHR-002]].');
		expect(rendered).toContain('id="CHR-001"');
		expect(rendered).toContain('data-wiki="CHR-002"');
	});
});

describe('EDT-002: Graphic and Binary File Rendering in Preview Mode', () => {
	const editorSrc = readFileSync(resolve(__dirname, '../src/lib/components/Editor.svelte'), 'utf-8');

	// @spec EDT-002
	it('correctly classifies graphic, raster, and binary formats', () => {
		// Graphics
		expect(isGraphic('map.svg')).toBe(true);
		expect(isGraphic('character.png')).toBe(true);
		expect(isGraphic('cover.jpg')).toBe(true);
		expect(isGraphic('scene.jpeg')).toBe(true);
		expect(isGraphic('animation.gif')).toBe(true);
		expect(isGraphic('illustration.webp')).toBe(true);
		expect(isGraphic('chapter.md')).toBe(false);

		// Raster images
		expect(isRasterImage('photo.png')).toBe(true);
		expect(isRasterImage('photo.jpg')).toBe(true);
		expect(isRasterImage('photo.webp')).toBe(true);
		expect(isRasterImage('diagram.svg')).toBe(false);

		// Binary files
		expect(isBinary('image.png')).toBe(true);
		expect(isBinary('book.pdf')).toBe(true);
		expect(isBinary('book.epub')).toBe(true);
		expect(isBinary('blob.bin')).toBe(true);
		expect(isBinary('doc.md')).toBe(false);
		expect(isBinary('vector.svg')).toBe(false);

		// Editability
		expect(isEditable('doc.md')).toBe(true);
		expect(isEditable('notes.txt')).toBe(true);
		expect(isEditable('vector.svg')).toBe(true);
		expect(isEditable('image.png')).toBe(false);
		expect(isEditable('image.jpg')).toBe(false);
		expect(isEditable('book.pdf')).toBe(false);

		// MIME types
		expect(getMimeType('image.png')).toBe('image/png');
		expect(getMimeType('image.jpg')).toBe('image/jpeg');
		expect(getMimeType('image.webp')).toBe('image/webp');
		expect(getMimeType('image.svg')).toBe('image/svg+xml');
		expect(getMimeType('doc.pdf')).toBe('application/pdf');
	});

	// @spec EDT-002
	it('disables or omits Edit mode for raster images and binary files in Editor component', () => {
		// Component imports format classification
		expect(editorSrc).toContain('isEditable');
		expect(editorSrc).toContain('isGraphic');
		expect(editorSrc).toContain('isBinary');

		// Edit button is disabled when not editable
		expect(editorSrc).toContain('disabled={!isEditable(path)}');

		// setMode guards against editing non-editable files
		expect(editorSrc).toContain("if (newMode === 'edit' && !isEditable(path))");
	});

	// @spec EDT-002
	it('renders graphics visually in preview mode with responsive scaling', () => {
		// Graphic image tag in preview mode
		expect(editorSrc).toContain('class="preview-graphic"');
		expect(editorSrc).toContain('src={graphicUrl}');

		// Responsive scaling without horizontal overflow
		expect(editorSrc).toContain('max-width: 100%');
		expect(editorSrc).toContain('object-fit: contain');
	});
});
