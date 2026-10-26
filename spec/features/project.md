---
prefix: PROJ
status: active
---
# Novel Project Management

## Requirements

### PROJ-001: Project Path Confinement
WHEN any file system read or write operation is requested with a relative path,
THE SYSTEM SHALL confine the target path strictly within the active project root and reject any paths that attempt directory traversal escapes.

Acceptance:
- Given an active project root at "/proj",
  when confine is invoked with relative path "../etc/passwd",
  then the operation fails with an error rejecting path traversal.
- Given an active project root at "/proj",
  when confine is invoked with relative path "kb/characters/CHR-001.md",
  then the resolved path is verified to reside inside "/proj".

### PROJ-002: Recent Projects Management
WHEN an author opens or creates a novel project,
THE SYSTEM SHALL record the project path and title in the recent projects list, keeping the list deduplicated and capped to the 12 most recent entries.

Acceptance:
- Given a newly opened novel project path "/novels/scifi",
  when addRecent is invoked,
  then the project appears at index 0 of recent projects with timestamp.
- Given a project already in the recents list,
  when reopened,
  then it moves to the top without creating a duplicate entry.

### PROJ-003: New Project Creation Action in Workspace Header
WHEN an author is in the workspace view with an open novel project,
THE SYSTEM SHALL provide a dedicated new project creation button ("+" icon) immediately adjacent to the project title widget in the application header, which triggers the new project scaffolding modal.

Acceptance:
- Given an active open novel project displayed in the workspace header,
  when viewed,
  then a "+" button is displayed adjacent to the project title widget.
- Given the author clicks the "+" button next to the project title widget,
  when clicked,
  then the New Project modal opens to allow scaffolding a new novel project.

### PROJ-004: Clean Initial Project Integrity State
WHEN a novel project is scaffolded and initialized,
THE SYSTEM SHALL ensure that the project's initial state contains zero integrity check errors and zero dangling references, ignoring guidance and template examples contained within HTML comments.

Acceptance:
- Given a newly created novel project directory,
  when `specnovel init` is executed followed by `specnovel check`,
  then the check completes with exit code 0 and zero integrity check errors.
- Given template guidance and example entities enclosed inside HTML comments (`<!-- ... -->`),
  when parsed for project model definitions and references,
  then the commented examples are ignored and do not produce dangling reference errors or Chekhov's gun violations.

### PROJ-005: Project Overview Dashboard
WHEN an author navigates to the Overview tab in the workspace view,
THE SYSTEM SHALL display a project overview comprising the project title, seed synopsis, core project metrics, and project integrity diagnostics, omitting redundant pipeline quick actions that duplicate the journey rail.

Acceptance:
- Given an author views the Overview dashboard,
  when rendered,
  then it displays the project title, synopsis preview, core metrics (scenes structured, abridged words, manuscript words, story bible entities), and diagnostics if any.
- Given an author views the Overview dashboard,
  when rendered,
  then it does not contain a "Pipeline Quick Actions" section or redundant pipeline stage action boxes.


