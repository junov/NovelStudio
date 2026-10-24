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

### AGT-002: Author Interview in Dedicated Window
WHEN an AI agent requests structured author feedback via ask_user,
THE SYSTEM SHALL launch an interactive interview session in a dedicated native window and deliver the author's responses back to the running agent engine.

Acceptance:
- Given an agent invokes the ask_user tool with questions,
  when running in Tauri desktop mode,
  then setInterviewPrompt stores the prompt and openInterviewWindow launches the dedicated window.
- Given author responses are submitted in the interview window,
  when submitInterviewAnswers is called,
  then the answers are delivered back to the main window engine and the interview window closes.
