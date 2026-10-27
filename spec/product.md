# NovelStudio Product Specification

## Vision
NovelStudio is a professional desktop environment for specification-driven novel writing powered by AI agents. It serves as an interactive GUI and execution driver for the SpecNovelist methodology, transforming novel writing from unstructured drafting into a disciplined, iterative engineering discipline where Story Bibles, Outlines, and Style Guides serve as living specifications for narrative prose.

## Target Users
- **Novelists & Fiction Authors**: Writers seeking architectural consistency, deep lore tracking, and AI-assisted drafting without losing creative agency.
- **SpecNovelist Practitioners**: Writers who previously operated the command-line `specnovel` toolkit and require an ergonomic visual studio with backlinks, waveforms, and live diff reviews.
- **Narrative Designers & Worldbuilders**: Creators managing complex multi-character story DAGs, causal scene prerequisites, and Chekhov guns across book series.

## Scope & Core Capabilities

### In Scope
- **Project Scaffolding & Journey Rail**: Interactive visual pipeline guiding authors through 9 distinct sequential delivery stages (Initial, Setup, Research, World, Narrative, Structure, Abridged, Manuscript, Publishable).
- **Dual-Mode Writing Editor**: Switching between structural Markdown editing (CodeMirror 6 "edit" mode) and rendered Markdown ("preview" mode) with live bidirectional wiki-link resolution.
- **Living Story Bible Explorer**: Categorized catalog of characters, places, objects, organizations, world rules, timeline events, glossary terms, facts, sources, research questions, themes, style rules, narrative arcs/beats/illustrations, structure scenes, and directives (`DIR`), continuously accessible throughout writing.
- **Autonomous Agent Loop & Tools**: Embedded pair-programmer loop calling LLM APIs directly with SpecNovelist tools (`read_file`, `write_file`, `specnovel`, `ask_user`, `read_toolkit_doc`).
- **Secure Multi-Provider AI Integration**: Direct API connection to Google Gemini (with credentials stored in OS Keychain / Windows Credential Manager) and native local execution via Antigravity CLI.
- **Distraction-Free Dedicated Windows**: Multi-window architecture providing separate native windows for AI configuration settings and interactive author interview sessions.
- **Narrative Analysis Dashboard**: Visual pacing waveforms, sensory radar charts, character agency radar, and Chekhov gun resolution matrices.
- **Multi-Format Book Compilation**: One-click manuscript export to EPUB, PDF, DOCX, and combined Markdown in `publishable/`.

### Out of Scope (Future Milestones)
- Cloud syncing or centralized team collaboration (remains local-first and Git-native).
- Direct e-book marketplace publishing integrations (KDP, IngramSpark).

## Glossary
- **SpecNovelist**: The specification-driven novel development methodology where structured Markdown files across 9 sequential stages specify narrative intent before prose is written.
- **Story Bible**: The curated encyclopedia of canonical entities (`world/`, `setup/`, `research/`, `narrative/`, `structure/`, `directives/`) continuously accessible across all stages.
- **Narrative DAG**: The directed acyclic graph of narrative beats (`BET-NNN`) and illustrations (`ILL-NNN`) governed by `Dependencies:` and rooted at `Denouement: true`.
- **Directives**: Cross-stage authorial and editorial rules (`directives/DIR-NNN.md`) locked in from user feedback and linked to impacted records.
- **Wiki-link**: Cross-reference syntax `[[ID]]` or `[[ID|Label]]` connecting prose, scenes, and beats directly to Story Bible entities.
- **Journey Rail**: The 9-stage progress tracker representing the path from initial synopsis to publishable book.
- **Walking Skeleton**: The minimal end-to-end executable pipeline slice.
