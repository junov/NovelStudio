---
prefix: AGT
status: active
---
# Agent Execution and Author Interview

## Requirements

### AGT-001: Unstaged File Execution for Agent Tools
WHEN an AI agent executes tools that modify or delete project files,
THE SYSTEM SHALL execute the file modifications directly to disk leaving them unstaged in Git for author review and acceptance, without halting execution for modal approval in the feed and without permitting agent-driven Git commits.

Acceptance:
- Given an agent executes write_file or delete_file,
  when invoked,
  then the file modifications are applied directly to disk as unstaged changes and the agent continues execution.
- Given file modifications applied by an agent,
  when inspected in Git,
  then the changes remain unstaged and are reflected in the project review state.
- Given any tool invocation attempting to commit changes or advance baselines,
  when intercepted,
  then the agent is strictly blocked from committing.

Notes: Linked to #6.

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

### AGT-007: Interactive Skill Routing for Author Feed Messages
WHEN an author submits a message or instruction in the agent feed prompt bar,
THE SYSTEM SHALL evaluate the author's input to select the most appropriate SpecNovelist skill (defaulting to novel-feedback for creative authoring, worldbuilding edits, outline/beat adjustments, or editorial directives, or routing to novel-generate, novel-sync, novel-verify, or novel-analyze based on intent), display the routed skill in the agent status header, and execute the agent loop under that skill's system context.

Acceptance:
- Given an author submits an instruction targeting Story Bible entities, character details, places, worldbuilding, narrative beats, scenes, or editorial directives (DIR),
  when the agent routing step evaluates the prompt,
  then the skill is routed to novel-feedback.
- Given an author submits an instruction explicitly requesting initial generation, scaffolding, discovery interviewing, or first-time drafting of a pipeline stage (initial, setup, research, world, narrative, structure, abridged, manuscript, or publishable),
  when the agent routing step evaluates the prompt,
  then the skill is routed to novel-generate.
- Given an author submits an instruction requesting incremental synchronization of a stage with upstream changes or rendering of pending assets,
  when the agent routing step evaluates the prompt,
  then the skill is routed to novel-sync.
- Given an author submits an instruction requesting quality verification, continuity checks, DAG validation, or placeholder auditing,
  when the agent routing step evaluates the prompt,
  then the skill is routed to novel-verify.
- Given an author submits an instruction requesting quantitative pacing waveforms, cadence entropy metrics, or developmental analysis reports,
  when the agent routing step evaluates the prompt,
  then the skill is routed to novel-analyze.
- Given an ambiguous, open-ended, or general creative authoring message with no explicit pipeline generation or sync command,
  when evaluated,
  then the system defaults to routing the request to novel-feedback.
- Given a routed skill is determined,
  when the agent starts running,
  then agent.currentSkill is updated to the routed skill, displayed in the panel header, and the corresponding skill documentation is included in the execution context.

### AGT-008: Journey Rail Pipeline Stages and Story Bible Decoupling
WHEN an author views or interacts with stages on the Journey Rail,
THE SYSTEM SHALL present the 9 sequential SpecNovelist pipeline stages (Initial, Setup, Research, World, Narrative, Structure, Abridged, Manuscript, Publishable) while maintaining the categorized Story Bible explorer as a continuous, non-sequential catalog accessible across all stages via the Explorer panel and interactive agent feed.

Acceptance:
- Given the Journey Rail rendered across the top of the workspace layout,
  when viewed,
  then the Journey Rail displays the 9 sequential stages (Initial, Setup, Research, World, Narrative, Structure, Abridged, Manuscript, Publishable).
- Given the author works in any project stage,
  when managing characters, locations, world rules, narrative beats, scenes, or directives,
  then the Story Bible remains continuously accessible via the Explorer panel and through agent chat.
- Given stage actions in the Journey Rail,
  when determining stage execution,
  then the system dispatches novel-generate for initial stage generation (when no stage baseline exists yet) and novel-sync for incremental stage synchronization (once a baseline exists).

### AGT-009: User-Controlled Journey Progression and Stage Isolation
WHEN an author launches a stage action from the Journey Rail or engages with the agent,
THE SYSTEM SHALL isolate execution strictly to the requested stage without automatically advancing to subsequent stages, without prompting or asking the author to move to the next stage upon completion, and without rendering automated next-step progression bars.

Acceptance:
- Given an author triggers a skill execution via the Journey Rail,
  when the skill finishes its tasks,
  then agent execution concludes and transitions to idle without automatically invoking subsequent pipeline skills.
- Given an agent executing any pipeline skill,
  when completing its work or communicating with the author,
  then the agent does not prompt or query the author asking to proceed or advance to the next pipeline stage.
- Given the Journey Rail rendered across the top of the workspace layout,
  when viewed,
  then no redundant "Next Step" action bar is displayed and stage advancement remains exclusively manual.

Notes: Linked to #8.

### AGT-010: Antigravity CLI Agent Driver Option in Provider Selection
WHEN an author configures AI providers and models in Settings,
THE SYSTEM SHALL provide "Antigravity CLI" as a selectable option in the Provider dropdown menu, persist this preference in settings, and route agent task execution through the local Antigravity CLI (`agy`) driver using structured headless mode (`--print`, `--output-format json`, `--dangerously-skip-permissions`) with multi-turn conversation session continuity (`--conversation`) and token metrics tracking without requiring direct provider API credentials.

Acceptance:
- Given the Settings modal or window,
  when the Provider select menu is viewed,
  then "Antigravity CLI" is included as a selectable provider option alongside OpenAI, Anthropic Claude, and Google Gemini.
- Given the author selects "Antigravity CLI" in the Provider menu,
  when saved,
  then defaultModel.provider is set to "antigravity" (with useAntigravityCli enabled and agentDriver set to "antigravity") and persisted in the settings store across reloads.
- Given an agent task is initiated with the Antigravity CLI provider selected,
  when execution starts,
  then the execution engine dispatches the instruction through the Antigravity CLI driver with --print, --output-format json, and --dangerously-skip-permissions, parses the structured response payload and token usage into the agent feed, and preserves conversation continuity across turns via conversation IDs.
- Given a model that does not support reasoning effort (such as flash) configured under the Antigravity CLI,
  when constructing CLI invocation flags,
  then reasoning effort parameters (--effort) are omitted to avoid invalid model selection errors.
