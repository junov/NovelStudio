---
prefix: JRN
status: active
---
# Pipeline Journey Rail

## Requirements

### JRN-001: Contextual Hover Cards for Journey Rail Elements
WHEN an author hovers over any interactive element of a stage node in the Journey Rail (the step body, the status pill, or the stage action play button),
THE SYSTEM SHALL display a styled hover card matching the application design system containing contextual details for the hovered target instead of browser-native tooltips.

Acceptance:
- Given an author hovers over a stage node body or label,
  when the hover card appears,
  then it displays the full stage title, sequence position (Stage N of 9), comprehensive stage description, associated paths, and the assigned skill (`novel-generate` or `novel-sync`).
- Given an author hovers over a status pill (drift, pending, or synced),
  when the hover card appears,
  then it displays a description of the state represented by the pill without Git-specific terminology or commit hashes, enumerating affected items or files contributing to drift (specifically listing upstream items from `upstream_drift` that have changed since the stage was last synced, distinguishing upstream drift from stage-internal changes), and enumerating pending items or scenes requiring generation for pending status pills.
- Given an author hovers over a stage action play button,
  when the hover card appears,
  then it displays a dynamic craft-oriented action title (such as "Draft Manuscript Prose" or "Build Narrative Beat DAG") and description of the exact actions that will be performed upon clicking without referencing raw skill names (e.g. novel-generate, novel-sync), referencing current project context and relevant entities.
- Given any active hover card in the Journey Rail,
  when rendered,
  then it utilizes application literary design tokens without exposing Git-specific terms or porcelain codes, and positions itself adjacent to the hovered element without clipping viewport boundaries.

Notes: Linked to #7.

### JRN-002: Dynamic Stage Action Feasibility and Play Button Disabling
WHEN a stage on the Journey Rail has no pending work or actions to perform based on project status, upstream prerequisites, and stage synchronization,
THE SYSTEM SHALL disable and gray out the stage's play button, and explain in the play button's hover card why no action is required or which upstream prerequisite must be completed first.

Acceptance:
- Given a stage where all criteria are satisfied and no work is pending, or where required upstream stages have not yet been generated (Synchronization Generation Gate),
  when evaluated,
  then the stage play button is visually grayed out and its click handler is disabled.
- Given an author hovers over a disabled play button,
  when the hover card appears,
  then it explicitly explains in craft-oriented terms without Git jargon why the action is inactive and states that the stage is up to date or waiting on upstream prerequisites.
- Given changes or drift occur that create pending work for a stage, or an ungenerated stage's upstream prerequisites become satisfied,
  when project status updates,
  then the play button reactively re-enables and dispatches initial generation (`novel-generate`) if not yet generated or incremental synchronization (`novel-sync`) if already generated.

Notes: Linked to #7.

