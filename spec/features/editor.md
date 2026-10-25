---
prefix: EDT
---

# Document Editor

## Requirements

### EDT-001: Document Editor with Edit and Preview Modes
WHEN an author views or edits documents in the workspace,
THE SYSTEM SHALL provide a document editor with an Edit mode powered by CodeMirror 6 and a Preview mode rendering Markdown with interactive wiki-links, toggled via pencil and eye icon controls without a WYSIWYG mode.

Acceptance:
- Given an open document,
  when viewed in the editor,
  then the editor toolbar displays toggle controls with an eye icon for Preview mode and a pencil icon for Edit mode.
- Given the editor controls,
  when inspected,
  then no WYSIWYG mode or rich-text editor controls are presented.
- Given an author selects Edit mode via the pencil icon,
  when active,
  then prose and Markdown content are editable directly via the CodeMirror 6 editor.
- Given an author selects Preview mode via the eye icon,
  when active,
  then the document is rendered as formatted Markdown with interactive wiki-link chips and heading anchors.

### EDT-002: Graphic and Binary File Rendering in Preview Mode
WHEN an author opens a graphic or binary file in the workspace,
THE SYSTEM SHALL render graphics (SVG and common raster image file formats including PNG, JPEG, GIF, and WebP) visually in Preview mode, and disable or omit Edit mode for raster images and binary file formats in general.

Acceptance:
- Given an author opens an SVG graphic file,
  when viewed in Preview mode,
  then the SVG image is rendered visually.
- Given an author opens a common raster image file (such as PNG, JPEG, GIF, or WebP),
  when viewed in Preview mode,
  then the image is displayed visually within the document view.
- Given an open raster image or binary file format,
  when inspected in the editor toolbar,
  then Edit mode is not available (the Edit mode toggle button is omitted or disabled).
- Given an open raster image or binary file format,
  when an author attempts to navigate or switch to Edit mode,
  then the editor remains in Preview mode.
- Given a graphic or raster image viewed in Preview mode,
  when displayed,
  then the graphic scales responsively within the viewport without horizontal overflow.

Notes: Linked to #3.
