/**
 * Diff highlighting for CodeMirror views in side-by-side diff mode.
 * @spec REV-003
 */
import { diffLines } from 'diff';
import { RangeSetBuilder, type Extension, type Text } from '@codemirror/state';
import { Decoration, type DecorationSet, ViewPlugin, type ViewUpdate, EditorView } from '@codemirror/view';

export const diffAddedLine = Decoration.line({ attributes: { class: 'cm-diff-added' } });
export const diffRemovedLine = Decoration.line({ attributes: { class: 'cm-diff-removed' } });

/**
 * Computes line-level decorations for the active document compared to otherText.
 * @param doc CodeMirror Text document
 * @param otherText The comparative text (HEAD version if isNew is true; or New version if isNew is false)
 * @param isNew Whether doc is the new version (decorates additions) or the baseline (decorates removals)
 */
export function computeDiffDecorations(doc: Text, otherText: string, isNew: boolean): DecorationSet {
	const currentText = doc.toString();
	const oldText = isNew ? otherText : currentText;
	const newText = isNew ? currentText : otherText;
	const lineDiffs = diffLines(oldText, newText);

	const builder = new RangeSetBuilder<Decoration>();
	let pos = 0;

	for (const part of lineDiffs) {
		if (isNew) {
			if (part.removed) continue;
			const partLen = part.value.length;
			if (part.added && doc.length > 0) {
				let currentPos = pos;
				while (currentPos < pos + partLen && currentPos <= doc.length) {
					const line = doc.lineAt(Math.min(currentPos, doc.length));
					builder.add(line.from, line.from, diffAddedLine);
					currentPos = line.to + 1;
				}
			}
			pos += partLen;
		} else {
			if (part.added) continue;
			const partLen = part.value.length;
			if (part.removed && doc.length > 0) {
				let currentPos = pos;
				while (currentPos < pos + partLen && currentPos <= doc.length) {
					const line = doc.lineAt(Math.min(currentPos, doc.length));
					builder.add(line.from, line.from, diffRemovedLine);
					currentPos = line.to + 1;
				}
			}
			pos += partLen;
		}
	}

	return builder.finish();
}

/**
 * Creates a CodeMirror ViewPlugin that maintains diff decorations against comparative text.
 */
export function diffHighlighter(getOtherText: () => string, isNew: boolean): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			otherText: string;

			constructor(view: EditorView) {
				this.otherText = getOtherText();
				this.decorations = computeDiffDecorations(view.state.doc, this.otherText, isNew);
			}

			update(update: ViewUpdate) {
				const currentOther = getOtherText();
				if (update.docChanged || currentOther !== this.otherText) {
					this.otherText = currentOther;
					this.decorations = computeDiffDecorations(update.state.doc, this.otherText, isNew);
				}
			}
		},
		{
			decorations: (v) => v.decorations
		}
	);
}
