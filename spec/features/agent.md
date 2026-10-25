---
prefix: AGT
status: active
---
# Agent Execution and Author Interview

## Requirements

### AGT-001: Tool Execution Safety and Approval Gate
WHEN an AI agent attempts to modify or delete project files and autoApprove is disabled,
THE SYSTEM SHALL halt execution, present a visual diff review to the author, and require explicit approval before modifying the file system.

Acceptance:
- Given autoApprove is false and the agent executes write_file,
  when invoked,
  then agent status transitions to awaiting_approval and registers an active approval request.
- Given the author approves the write,
  when accepted,
  then the file is committed to disk and the agent resumes execution.

### AGT-002: Inline Author Interview in Agent Feed
WHEN an AI agent requests structured author feedback via ask_user,
THE SYSTEM SHALL display an interactive interview card inline directly within the agent activity feed at the active stream position, maintain viewport auto-scroll to the card, and deliver the author's responses back to the running agent engine upon submission without generating empty placeholder feed entries.

Acceptance:
- Given an agent invokes the ask_user tool with structured questions,
  when executed,
  then the agent status transitions to awaiting_user_input and an interactive InterviewCard renders inline at the active bottom position of the agent feed without launching an external window.
- Given an active interview card rendered in the feed,
  when mounted,
  then the activity feed smoothly auto-scrolls to bring the interview card into view, and no empty placeholder feed entries (such as "Presenting N question(s) to author") are added to the feed stream.
- Given an author submits their answers or skips questions in the inline interview card,
  when confirmed,
  then activeQuestion is cleared, a permanent completed interview summary entry is appended to the feed history, and agent execution resumes with the structured answers.
- Given an active interview request awaiting user input,
  when the author clicks Cancel in the agent panel header,
  then the pending interview request is canceled, activeQuestion is cleared, and agent status returns to idle.

### AGT-003: Selectable and Copyable Agent Feed Content
WHEN an author views entries in the agent activity feed,
THE SYSTEM SHALL enable text selection and copying across feed entries, titles, outputs, code blocks, and conversation messages.

Acceptance:
- Given an author views any activity feed item or content output in the agent panel,
  when attempting to select text,
  then text selection is permitted (user-select: text) and content can be copied to the clipboard.
- Given chrome header controls or status indicators in the agent panel,
  when rendered,
  then non-content chrome elements preserve standard UI affordances while the feed content remains selectable.

### AGT-004: Drag-Resizable Agent Panel Width
WHEN an author drags the left border of the agent activity panel,
THE SYSTEM SHALL dynamically resize the width of the agent feed, constrain the width within defined minimum and maximum boundaries, and persist the author's preferred width across sessions.

Acceptance:
- Given the agent activity panel rendered on the workspace layout,
  when viewed,
  then a vertical resize handle is provided along its left boundary with an appropriate resize cursor affordance (col-resize).
- Given the author drags the resize handle horizontally,
  when dragged left or right,
  then the agent panel width adjusts smoothly while respecting minimum (280px) and maximum (800px) limits.
- Given an adjusted panel width,
  when the window or app is reloaded,
  then the persisted width preference is restored.
- Given the author double-clicks the resize handle,
  when clicked,
  then the panel width resets to its default baseline width (360px).

### AGT-005: Author Interview Card Schema and Form Controls
WHEN an author interacts with an active InterviewCard,
THE SYSTEM SHALL render all fields defined by the ask_user tool schema (round title, batched questions, craft guidance with formatted markdown and links, selectable options with labels and descriptions, recommended pre-selection, multi-select toggles, freeform write-in inputs with dedicated selection indicators, and skip controls) and package author answers conforming to the user answer schema.

Acceptance:
- Given an ask_user tool call with an optional title and an array of 1 to 4 questions,
  when rendered,
  then the InterviewCard displays the header title, numbers each question sequentially (e.g. Q1, Q2), and displays the question prompt.
- Given a question containing craft context in its details field,
  when rendered,
  then the details text is parsed as formatted markdown with clickable wiki-links and external URLs.
- Given a question with selectable options,
  when rendered,
  then each option displays its label, optional descriptive text beneath the label, and a selection indicator.
- Given a question specifying recommendedIndex or defaultValue,
  when initialized,
  then the designated option is automatically pre-selected.
- Given a question with isMultiSelect set to false or omitted,
  when the author selects an option,
  then single-select (radio) behavior is enforced; when isMultiSelect is true, multiple options can be toggled independently (checkbox behavior).
- Given a question with allowFreeform set to true or omitted,
  when viewed,
  then the freeform custom write-in field is rendered as a selectable option with an associated selection indicator (radio indicator in single-select, or checkbox in multi-select).
- Given a freeform custom write-in field,
  when the author focuses the input field or clicks its custom option pill,
  then the custom option is automatically selected, any previous single-select predefined option is deselected, and the question is un-skipped.
- Given a non-custom option is the active selection in single-select mode,
  when viewed,
  then any text appearing in the custom text input field is visually grayed out and inactive; when the interview is submitted with a non-custom option selected, custom text is omitted from the submission.
- Given a question with allowSkip set to true or omitted,
  when viewed,
  then a skip toggle button is rendered allowing the author to defer or skip the question without blocking submission; questions with allowSkip set to false do not display a skip button.
- Given an author submits the interview,
  when confirmed,
  then answers are returned as an array of objects matching the UserAnswer schema containing questionId, selected option labels (if any), custom text (if any and custom was active), and skipped status.

Notes: Linked to #1.

### AGT-006: Grouped Activity Feed Work Cards with In-Progress Indicator
WHEN consecutive background execution entries (tool_start, tool_end, thought) occur in the agent activity feed,
THE SYSTEM SHALL group them into an expandable work card that is collapsed by default, render an active work card at the bottom of the feed whenever the agent is busy (even when empty), and display an in-progress visual animation on the active work card until the work step concludes.

Acceptance:
- Given consecutive feed entries of type tool_start, tool_end, or thought,
  when rendered in the agent feed,
  then they are clustered into a single parent Work Card displaying a summary header with the number of work items and the latest item.
- Given a clustered Work Card in the agent feed,
  when rendered,
  then it is collapsed by default to keep the feed clean, with an author toggle to expand and inspect the underlying entries.
- Given the agent status is busy (running),
  when viewed,
  then an active Work Card is displayed at the bottom of the feed, even if no tool or thought events have been recorded yet.
- Given an active Work Card representing work in progress,
  when the agent is running,
  then the card displays an in-progress visual animation and active status indicator.
- Given the agent finishes running or pauses for author input or approval,
  when the busy state ends,
  then the active Work Card transitions to a settled state, stopping the in-progress animation.
- Given distinct milestone feed items (such as question, approval, message, error, or sync_baseline),
  when rendered,
  then they break the consecutive work grouping and render as standalone feed cards at their chronological positions.

Notes: Linked to #2.
