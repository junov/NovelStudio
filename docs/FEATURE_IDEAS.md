# NovelStudio — UI Feature Ideas

## A. Ease of use

| # | Feature | What it does | Backed by |
|---|---|---|---|
| A1 | **Pipeline Journey Rail** | Persistent rail: Brief → Research → Bible → Outline → Graphics → Abridged → Manuscript → Publish with per-stage status and a "Next recommended action" button. | `status`, `delta`, `impact`, `log` |
| A2 | **New Project Wizard** | Pick folder → `init` → write synopsis → launch the interview. | `init` |
| A3 | **Interview Cards** | `novel-init` questions rendered as cards with recommended defaults and "Skip / Decide later". | `novel-init` |
| A4 | **Wiki-link Navigation** | `[[ID]]` chips colored by entity type, hover previews, back/forward history, backlinks panel. | `trace`, `index` |
| A5 | **Command Palette** (Ctrl+K) | Jump to any ID/name/file; run any skill or command. | `index` |
| A6 | **Review & Accept Diffs** | Every AI edit is reviewable; "Accept baseline" commits with `Novel-Model:` trailer. | `accept` |
| A7 | **Problems Panel + Lint Gutter** | `check`/`dag` errors inline and in a list. | `check`, `dag` |
| A8 | **Agent Activity Feed** | Live log of files read/written, sources fetched, commands run; cancel. | agent loop |
| A9 | **Model & Cost Manager** | Per-stage model; token/cost meter; warnings before expensive renders. | providers, `models` |
| A10 | **Acknowledgements Guard** | Prompts to disclose new models in `acknowledgements.md`. | `models` |

## B. Creative expression

| # | Feature | What it does | Backed by |
|---|---|---|---|
| B1 | **Corkboard Outline** | Drag-and-drop index cards with live DAG validation. | `outline.md`, `dag` |
| B2 | **Story DAG Canvas** | Interactive causality graph; draw edges to add prerequisites. | `dag` |
| B3 | **Timeline & Swimlanes** | Scenes/events on a time axis per character. | `TML`, `When:` |
| B4 | **Relationship Web** | Character/organization graph. | `kb/` |
| B5 | **Triple-Pane Layers** | Outline ↔ Abridged ↔ Manuscript synced by `SCN`. | drafts |
| B6 | **Takes Studio** | Alternative scene takes, side-by-side compare, activate. | `takes` |
| B7 | **What-if Scenarios** | Story branches; diff, merge or discard. | `scenario` |
| B8 | **Style Mixer** | Sliders that write `style.md` with a live sample paragraph. | `style.md` |
| B9 | **Margin Notes → Editorial Triage** | Comments routed to style / KB / outline / `EDT`. | `feedback` |
| B10 | **Character Voice Lab** | Chat with a character in voice; save voice anchors. | `CHR` |
| B11 | **Analysis Dashboard** | Pacing waveform, sensory radar, cadence entropy, word-count vs target. | `audit`, `stats` |
| B12 | **Research Board** | `RQ` kanban, placeholder highlighting, source gallery. | `placeholders` |
| B13 | **Graphics Gallery** | `GFX` specs + rendered assets. | `graphics/` |
| B14 | **Book Preview** | Typeset preview using book-design settings; one-click compile. | `compile` |
| B15 | **Focus / Read-Aloud** | Distraction-free mode; TTS playback. | — |
