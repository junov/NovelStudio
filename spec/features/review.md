---
prefix: REV
---

# Git Review and Accept Flow

## Requirements

### REV-001: Unstaged Change Tracking and Navigator Visual Cues
WHEN an author or agent modifies files in the project workspace,
THE SYSTEM SHALL retain all modifications as unstaged Git changes and reactively display visual change indicators in the Story Bible, Outline, and Files navigators.

Acceptance:
- Given any manual edit in the editor or file modification executed by an agent,
  when written to disk,
  then the changes remain unstaged in Git and are detected by the project state.
- Given a file, Story Bible entity, or Outline scene with unstaged Git changes,
  when viewed in their respective navigators,
  then a distinct visual indicator is displayed marking the item as modified.

Notes: Linked to #6.

### REV-002: Navigator Item and File Accept and Revert Actions
WHEN an item in the Story Bible, Outline, or Files navigator has unstaged changes,
THE SYSTEM SHALL display paired Accept and Revert buttons next to the item, committing the item's changes on accept or restoring the committed version on revert, and immediately dismiss the buttons once either action is triggered.

Acceptance:
- Given an item in the Story Bible, Outline, or Files navigator with unstaged changes,
  when displayed,
  then both an Accept button and a Revert button are rendered alongside the item.
- Given an author clicks the Accept button on a file in the Files navigator,
  when clicked,
  then the unstaged changes for that file are committed to Git and the accept/revert buttons disappear.
- Given an author clicks the Accept button on an entity in the Story Bible or Outline navigator,
  when clicked,
  then the unstaged changes for that specific item are committed to Git and the buttons disappear.
- Given an author clicks the Revert button on an item or file,
  when clicked,
  then the unstaged changes are reverted to the Git HEAD revision, restoring the previous content and dismissing the buttons.

Notes: Linked to #6.

### REV-003: Side-by-Side Editable Diff Mode in Document View
WHEN a document with unstaged Git changes is open in the document view,
THE SYSTEM SHALL present a diff mode toggle ("+/-" icon) in the editor toolbar, and when active, render a side-by-side diff with the editable new version on the left and the committed baseline version on the right, and scroll target entities into view when navigating from navigators or wiki-links.

Acceptance:
- Given a document with no unstaged changes,
  when viewed in the editor,
  then the "+/-" diff mode icon is not visible in the toolbar.
- Given a document with unstaged Git changes,
  when viewed in the editor,
  then the "+/-" diff mode button is displayed in the editor toolbar.
- Given an author activates diff mode via the "+/-" button,
  when rendered,
  then a side-by-side diff view is shown in the CodeMirror editor style.
- Given the side-by-side diff view,
  when interacted with,
  then the new version on the left is editable while the right side displays the read-only baseline from Git HEAD, and the diff panes provide visible scrollbars.
- Given the side-by-side diff view,
  when displayed,
  then differences between the new version and the committed baseline are visually highlighted with diff styling (additions highlighted in the new version and deletions highlighted in the baseline).
- Given an author navigates to an entity item or follows a wiki-link while in diff mode,
  when navigated,
  then the side-by-side diff view automatically scrolls the targeted item or line into view in the diff panes.

Notes: Linked to #6.

### REV-004: Agent Git Commit Guardrail
WHEN an AI agent invokes tools during task execution,
THE SYSTEM SHALL strictly block the agent from executing Git commits or baseline accept commands (`specnovel accept`), guaranteeing that Git commits occur solely in response to explicit author interaction with Accept controls in the UI.

Acceptance:
- Given an agent attempts to execute `specnovel accept` or any commit command via agent tools,
  when evaluated by the tool execution engine,
  then the command is rejected with an error and no Git commit is created.
- Given an agent tool modifying project files,
  when completed,
  then all modified files remain unstaged in Git until the author clicks an Accept button in the navigator.
- Given the `novel-author` skill and agent system prompt,
  when configured,
  then instructions explicitly direct the agent to leave changes unstaged for user review without attempting baseline acceptance.

Notes: Linked to #6.
