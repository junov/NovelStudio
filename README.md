# NovelStudio ❦

**NovelStudio** is a desktop GUI application designed for the [SpecNovelist](https://github.com/junov/SpecNovelist) specification-driven fiction writing process. Built on **Tauri 2**, **Svelte 5**, and **TypeScript**, NovelStudio provides a literary, distraction-free environment that drives every stage of novel development—from seed synopsis and interactive discovery interviews to outline DAG validation, abridged pacing reviews, style-guided manuscript rendering, developmental editorial telemetry, and publication-ready book compilation.

---

## Key Features

### 1. Persistent Pipeline Journey Rail
- Tracks your project across all **7 SpecNovelist stages**: Brief → Research → Outline → Graphics → Abridged → Manuscript → Publish.
- Visualizes status pills, file drifts, and pending scene impacts with rich contextual hover cards.


### 2. New Project Wizard & Seed Synopsis
- Quickly scaffold a new novel repository with SpecNovelist's standardized layout (`story/`, `kb/`, `outline/`, `abridged/`, `manuscript/`).
- Write your initial seed premise in a warm, paper-textured editor.
- Automatically launches the Stage 1 discovery interview upon creation.

### 3. Interactive Interview Cards (`ask_user`)
- Rather than unstructured chatbot prompts, the discovery interview runs through structured **Interview Cards**.
- Selectable craft options with clearly marked **`(Recommended)` defaults**, contextual craft scaffolding, definitions, and **"Skip / Decide later"** buttons for full creative control.

### 4. Interactive Wiki-Link Navigation & Backlinks
- Entity references (`[[CHR-001|Elena]]`, `[[PLC-005]]`, `[[FCT-012]]`) are dynamically rendered as styled, color-coded entity chips with hover tooltips.
- Click any wiki-link to jump directly to its definition in the knowledge base.
- Built-in **Backlinks Panel** surfaces every scene beat, research question, or chapter that cites the current entity.

### 5. Dual-Mode Reading & Source Editor
- **WYSIWYG Reading Mode**: Rich typography powered by TipTap with full markdown formatting, serif reading font, and live wiki-links.
- **Source Mode**: Full CodeMirror 6 markdown editor with syntax highlighting, line numbers, and bracket pairing.
- Hotkey auto-save (`Ctrl+S`) and real-time word counter.

### 6. Review & Accept Diffs
- AI modifications to knowledge base entries, outlines, or prose drafts produce unified line-by-line diff previews.
- Accept or reject edits with an option to toggle "auto-approve for this run".
- Accepting baselines automatically stamps git commit trailers with the contributing model provenance (`Novel-Model:`), ensuring continuous compliance with `story/acknowledgements.md`.

### 7. Developmental Editorial & Pacing Telemetry Dashboard
- Multi-dimensional visualization powered by `specnovel.py audit --json`:
  - **Pacing Waveforms**: Scene word count and dialogue ratios with warning flags for talking-head (>80%) or exposition-heavy (<5%) sequences.
  - **Sensory Grounding Radar**: Five-modality sensory distribution (Visual, Auditory, Tactile, Olfactory, Gustatory).
  - **Character Agency**: POV scenes, cast appearances, and screen-time coverage percentages.
  - **Chekhov's Gun Matrix**: Automated tracking of narrative setups, payoffs, and scene distance gaps.
  - One-click button to compile comprehensive markdown analysis reports (`specnovel.py audit --report`).

### 8. Book Publication & Compilation Studio
- Compiles the complete novel in reading order into **EPUB**, **PDF**, **Word (.docx)**, or assembled **Markdown** via `specnovel.py compile`.
- Automatically enforces and injects mandatory verbatim AI model acknowledgements (`story/acknowledgements.md`), DAG-filtered bibliography, and style-guided glossary.

### 9. Multi-Provider AI Model Selection & OS Keychain Security
- Support for **Anthropic Claude**, **OpenAI**, and **Google Gemini**.
- API credentials are stored securely in your operating system's native keychain (Windows Credential Manager, macOS Keychain, Secret Service).
- Configure models globally or assign specialized models per pipeline stage (e.g. lightweight models for research queries, flagship models for literary prose rendering).

---

## Tech Stack & Architecture

- **Desktop Shell**: [Tauri 2](https://tauri.app/) (Rust 1.89+)
- **UI Framework**: [Svelte 5](https://svelte.dev/) + [SvelteKit](https://kit.svelte.dev/) (Static SPA adapter)
- **Styling**: Literary warm theme with Paper Light and Ink Dark palettes, serif typography (EB Garamond), and responsive layouts
- **Engine Core**: Embedded AI agent loop consuming SpecNovelist `AGENTS.md` rules and `SKILL.md` task specifications
- **Toolkit Integration**: Direct git submodule dependency on [SpecNovelist](https://github.com/junov/SpecNovelist) (`third_party/specnovelist`)

---

## Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ LTS)
- [Rust](https://rustup.rs/) (v1.89+)
- [Python 3.10+](https://www.python.org/)
- [Git](https://git-scm.com/)

### Clone & Install
```bash
# Clone with submodules
git clone --recursive https://github.com/junov/NovelStudio.git
cd NovelStudio

# Install frontend dependencies
npm install
```

### Run in Development
```bash
# Run web preview
npm run dev

# Run desktop application with Tauri
npm run tauri dev
```

### Running Tests
```bash
# Run frontend unit tests
npm test

# Run Rust unit tests
cd src-tauri
cargo test
```

### Building Release Package
```bash
npm run build
npm run tauri build
```

---

## License

This project is licensed under the [MIT License](LICENSE).
SpecNovelist is included as an external submodule under `third_party/specnovelist`.
