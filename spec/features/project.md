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
