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
