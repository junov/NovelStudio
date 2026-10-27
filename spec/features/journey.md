---
prefix: JRN
status: active
---
# Pipeline Journey Rail

## Requirements

### JRN-001: Contextual Hover Cards for Journey Rail Elements
WHEN an author hovers over any interactive element of a stage node in the Journey Rail (the step body or the status/action pills),
THE SYSTEM SHALL display a styled hover card matching the application design system containing contextual details for the hovered target instead of browser-native tooltips.

Acceptance:
- Given an author hovers over a stage node body or label,
  when the hover card appears,
  then it displays the full stage title, sequence position (Stage N of 9), comprehensive stage description, associated paths, and the assigned skill (`novel-generate` or `novel-sync`).
- Given an author hovers over a status or action pill ("GEN", "SYNC", pending, or "SYNCED"),
  when the hover card appears,
  then for "SYNC" it displays a description of the drift state without Git-specific terminology, enumerating affected items contributing to drift under the subtitle "Upstream Items with Changes (<count>)" with the synchronization action prompt, and for "GEN" it displays the craft-oriented action title, description of initial generation actions, target scope, and action feasibility or prerequisite guidance.
- Given any active hover card in the Journey Rail,
  when rendered,
  then it utilizes application literary design tokens without exposing Git-specific terms or porcelain codes, and positions itself adjacent to the hovered element without clipping viewport boundaries.
- Given any status or action pill rendered on a stage node in the Journey Rail (including "GEN", "SYNC", "SYNCED", pending, "unaccepted", and "Accept"),
  when displayed,
  then its text label is presented in ALL CAPS (uppercase).

Notes: Linked to #7.

### JRN-002: Dynamic Stage Action Feasibility and Action Pill Disabling
WHEN a stage on the Journey Rail has no pending work or actions to perform based on project status, upstream prerequisites, and stage synchronization,
THE SYSTEM SHALL disable and gray out the stage's action pill ("GEN" or "SYNC") in place of a standalone play button, and explain in the hover card why no action is required or which upstream prerequisite must be completed first.

Acceptance:
- Given a stage where required upstream stages have not yet been generated (Synchronization Generation Gate),
  when evaluated,
  then the stage "GEN" action pill is visually grayed out and its click handler is disabled.
- Given an author hovers over a disabled action pill ("GEN" or "SYNC"),
  when the hover card appears,
  then it explicitly explains in craft-oriented terms without Git jargon why the action is inactive and states that the stage is up to date or waiting on upstream prerequisites.
- Given changes or drift occur that create pending work for a stage, or an ungenerated stage's upstream prerequisites become satisfied,
  when project status updates,
  then the action pill reactively enables, allowing authors to dispatch initial generation ("GEN") or incremental synchronization ("SYNC").

Notes: Linked to #7.

### JRN-003: Journey Rail Stage Acceptance Action
WHEN a pipeline stage on the Journey Rail has uncommitted diffs or unaccepted changes,
THE SYSTEM SHALL provide an interactive "Accept" pill action on the stage node that runs `specnovel accept --stage <stage>` to commit and baseline the stage changes in Git, displaying a contextual hovercard listing the uncommitted files belonging to the stage upon hover, while displaying the action only on stages with uncommitted working-tree diffs.

Acceptance:
- Given a stage on the Journey Rail with uncommitted diffs in the working tree,
  when displayed,
  then the stage node provides an interactive "Accept" pill action adjacent to its status pill.
- Given an author hovers over the "Accept" pill on a stage node,
  when hovered,
  then a contextual hovercard is displayed listing the files with uncommitted changes that belong to that stage.
- Given a stage on the Journey Rail with no uncommitted diffs in the working tree (including stages that only exhibit upstream drift or pending items without working-tree changes, and stages whose directories are unmodified boilerplate),
  when displayed,
  then the stage node strictly does not display the "Accept" pill action.
- Given an author clicks the "Accept" pill on a stage node,
  when clicked,
  then the system invokes `specnovel accept --stage <stage>`, committing the stage files and recording the `Novel-Sync: <stage>` trailer, automatically passing `--force` if integrity checks report non-fatal craft warnings.
- Given the stage changes are accepted,
  when the operation completes and project status refreshes,
  then the stage status pill updates to "synced", unstaged files for the stage are cleared, and the Accept pill is dismissed.
- Given an acceptance operation fails,
  when the failure occurs,
  then the system surfaces the error to the author and preserves the uncommitted state without dismissing the Accept pill.

### JRN-004: Current Stage Tracking and Highlighting
WHEN an author interacts with the workspace,
THE SYSTEM SHALL maintain a single active current stage across the pipeline, visually highlight the current stage node in the Journey Rail using the same ambient radial gradient as non-current stages rendered over a lighter background, and update the current stage whenever the author clicks a stage node or any child widget.

Acceptance:
- Given the Journey Rail,
  when rendered,
  then exactly one stage is designated as the current stage and is visually highlighted using the same radial gradient as non-current stages rendered over a lighter background, without displaying an inset border on the node container.
- Given non-current stages on the Journey Rail,
  when rendered,
  then they display the radial gradient over the standard paper background with elevation drop shadows, visually contrasting with the lighter elevated current stage.
- Given an author clicks a stage node or any child widget within that stage node (step label, status pill, or accept button),
  when clicked,
  then that stage becomes the active current stage and receives the visual highlight.

### JRN-005: Initial Stage Pending Lifecycle
WHEN a novel project is opened or initialized,
THE SYSTEM SHALL present all pipeline stages in the pending state until each stage is generated for the first time, transitioning unbaselined stages to an unaccepted state with an accept action only after stage generation has completed.

Acceptance:
- Given a newly created or ungenerated project stage,
  when displayed on the Journey Rail,
  then the stage presents an interactive "GEN" pill in the "pending" state to trigger initial generation without exhibiting drift or unaccepted pills.
- Given an author runs stage generation via the agent or generates initial stage content,
  when generation completes,
  then the stage transitions from "pending" to "needs-sync" with an "unaccepted" status and displays the interactive "Accept" pill.
- Given an author accepts the stage baseline,
  when accepted,
  then the stage transitions to the "synced" state.
- Given a novel project in its initial state immediately following creation,
  when viewed on the Journey Rail,
  then all initial files are committed, the initial stage is in the "synced" state, and zero "Accept" pills are exhibited across the pipeline.

### JRN-006: Interactive Stage Action Pill (GEN and SYNC)
WHEN a stage on the Journey Rail requires initial generation, or exhibits local or upstream drift,
THE SYSTEM SHALL present the status pill as an interactive action button ("GEN" when ungenerated, "SYNC" when drifted) without numerical counts that dispatches stage generation or synchronization when clicked, removing any standalone play button.

Acceptance:
- Given a stage on the Journey Rail where content has not yet been generated,
  when displayed,
  then its status pill is labeled "GEN" (in ALL CAPS) and rendered as an interactive generation button.
- Given a stage on the Journey Rail with local or upstream drift,
  when displayed,
  then its status pill is labeled "SYNC" (in ALL CAPS, without numbers) and rendered as an interactive synchronization button.
- Given an author clicks the "GEN" button,
  when clicked,
  then the system sets the stage as the current active stage and dispatches stage generation (`novel-generate`) with the stage's initial generation prompt.
- Given an author clicks the "SYNC" button,
  when clicked,
  then the system sets the stage as the current active stage and dispatches stage synchronization (`novel-sync`) with the stage's synchronization prompt.
- Given the agent is actively executing a task (`agent.status === 'running'`),
  when evaluated,
  then the action button is disabled to prevent concurrent agent runs.
- Given an author hovers over the action button ("GEN" or "SYNC"),
  when hovered,
  then the contextual hover card is displayed presenting craft-oriented action details without exhibiting conflicting browser-native tooltip attributes.





