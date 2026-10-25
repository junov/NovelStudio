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
THE SYSTEM SHALL display an interactive interview card inline directly within the agent activity feed and deliver the author's responses back to the running agent engine upon submission.

Acceptance:
- Given an agent invokes the ask_user tool with structured questions,
  when executed,
  then the agent status transitions to awaiting_user_input and an interactive InterviewCard renders inline within the agent feed without launching an external window.
- Given an author selects options, types write-in text, or skips questions in the inline interview card,
  when the author clicks submit,
  then the answers are delivered back to the agent engine, activeQuestion is cleared, and agent execution resumes.

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
