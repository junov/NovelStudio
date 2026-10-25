---
prefix: BBL
status: active
---
# Story Bible and Knowledge Graph

## Requirements

### BBL-001: Story Bible Entity Categorization
WHEN project Markdown files are scanned,
THE SYSTEM SHALL categorize files into entity kinds based on directory prefix and filename pattern (Characters, Places, Lore, Items, Factions).

Acceptance:
- Given a file path "kb/characters/CHR-001-alice.md",
  when parsed,
  then kind is identified as "character" and entity ID as "CHR-001".
- Given a file path "kb/places/PLC-005-citadel.md",
  when parsed,
  then kind is identified as "place" and entity ID as "PLC-005".

### BBL-002: Bidirectional Wiki-link Extraction
WHEN Markdown prose or scene files contain wiki-link patterns like `[[TARGET]]` or `[[TARGET|Display]]`,
THE SYSTEM SHALL extract all outbound references and maintain bidirectional backlink indexes.

Acceptance:
- Given Markdown text containing "Alice met [[CHR-002|Bob]] at the [[PLC-001]].",
  when extractWikiLinks is invoked,
  then two links are returned with target IDs "CHR-002" and "PLC-001".
- Given an entity "CHR-002",
  when queried for backlinks,
  then all referencing files and line numbers are listed.

### BBL-003: Centralized Wiki-Link Navigation and Target Item Scrolling
WHEN an author clicks an interactive wiki-link in rendered Markdown, in the Story Bible explorer, or in the agent activity feed,
THE SYSTEM SHALL navigate the workspace document view to the defining document and automatically scroll to the exact position of the targeted item.

Acceptance:
- Given an author clicks a wiki-link chip (`[[TARGET]]`) in any rendered Markdown document,
  when clicked,
  then the system executes the centralized navigation handler (`project.openId`), opening the target entity's defining file.
- Given an author clicks an entity item in the Story Bible or outline explorer,
  when clicked,
  then the same centralized navigation handler is invoked to open the defining document.
- Given a wiki-link appearing in the agent activity feed,
  when rendered,
  then it is displayed as a clickable entity link that invokes the centralized navigation handler upon click.
- Given the document view opens or updates for a target entity or line number,
  when loaded,
  then the document viewport automatically scrolls to the heading, element, or line corresponding to that entity.
- Given a wiki-link referencing an entity within the currently active document,
  when clicked,
  then the view scrolls directly to the position of that item within the open document without failing or ignoring the click.

Notes: Linked to #4.
