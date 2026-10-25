# NovelStudio Product Specification

## Vision
NovelStudio is a professional desktop environment for specification-driven novel writing powered by AI agents. It serves as an interactive GUI and execution driver for the SpecNovelist methodology, transforming novel writing from unstructured drafting into a disciplined, iterative engineering discipline where Story Bibles, Outlines, and Style Guides serve as living specifications for narrative prose.

## Target Users
- **Novelists & Fiction Authors**: Writers seeking architectural consistency, deep lore tracking, and AI-assisted drafting without losing creative agency.
- **SpecNovelist Practitioners**: Writers who previously operated the command-line `specnovel` toolkit and require an ergonomic visual studio with backlinks, waveforms, and live diff reviews.
- **Narrative Designers & Worldbuilders**: Creators managing complex multi-character story DAGs, causal scene prerequisites, and Chekhov guns across book series.

## Scope & Core Capabilities

### In Scope
- **Project Scaffolding & Journey Rail**: Interactive visual pipeline guiding authors through 8 distinct stages (Brief, Research, Story Bible, Outline, Drafting, Critique, Revision, Compilation).
- **Dual-Mode Writing Editor**: Switching between structural Markdown editing (CodeMirror 6 "edit" mode) and rendered Markdown ("preview" mode) with live bidirectional wiki-link resolution.
- **Living Story Bible Explorer**: Categorized catalog of characters, places, items, factions, lore, and outline scenes with status badges and entity cards.
- **Autonomous Agent Loop & Tools**: Embedded pair-programmer loop calling LLM APIs directly with SpecNovelist tools (`read_file`, `write_file`, `specnovel`, `ask_user`, `read_toolkit_doc`).
- **Secure Multi-Provider AI Integration**: Direct API connections to Anthropic Claude, Google Gemini, and OpenAI with encrypted credentials stored in OS Keychain (Windows Credential Manager).
- **Distraction-Free Dedicated Windows**: Multi-window architecture providing separate native windows for AI configuration settings and interactive author interview sessions.
- **Narrative Analysis Dashboard**: Visual pacing waveforms, sensory radar charts, character agency radar, and Chekhov gun resolution matrices.
- **Multi-Format Book Compilation**: One-click manuscript export to EPUB, PDF, DOCX, and combined Markdown.

### Out of Scope (Future Milestones)
- Cloud syncing or centralized team collaboration (remains local-first and Git-native).
- Direct e-book marketplace publishing integrations (KDP, IngramSpark).

## Glossary
- **SpecNovelist**: The specification-driven novel development methodology where structured Markdown files specify narrative intent before prose is written.
- **Story Bible**: The curated encyclopedia of entities (`kb/characters/`, `kb/places/`, `kb/lore/`) defining canonical facts.
- **Wiki-link**: Cross-reference syntax `[[ID]]` or `[[ID|Label]]` connecting prose and scenes directly to Story Bible entities.
- **Journey Rail**: The 8-stage progress tracker representing the path from concept brief to finished book.
- **Walking Skeleton**: The minimal end-to-end executable pipeline slice.
