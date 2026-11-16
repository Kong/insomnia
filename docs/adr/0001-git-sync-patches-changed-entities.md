# Git Sync patches the entities the database changed

## Status

accepted

## Context

Git Sync kept two representations of a project: the NeDB database the app works on, and the YAML files in the repository. The database-to-file writer regenerated the whole file from the database on every change. Importing a file is lossy — comments, indentation, entity order, unknown fields and deliberately absent fields never reach the database — so every write silently discarded them. A file edited by hand, or written by another version of Insomnia, was rewritten the next time the app opened, and the change could not be discarded: the regenerated file differed from the committed one, so discarding it produced the same diff again.

## Decision

The writer no longer regenerates a file. It computes the delta between the file's base (that file as the database sees it) and the database, and patches only the affected entities into the original text. Everything else — bytes of untouched entities, including their comments, unknown fields, hand order and deleted fields — is left alone. A file with an empty delta is not written at all.

## Considered Options

- **Compare the database against a scratch database imported from the file.** Rejected: both sides are model states, so absence, unknown fields and entity order are invisible to the comparison, and fields the model fills in make the two sides differ permanently.
- **Three-way merge with a stored baseline.** Rejected as the first step: it needs persistent state and conflict resolution to buy correctness for a case (both sides changing the same entity) that has no cheap answer anyway.
- **Whole-file rewrite as a fallback when patching fails.** Rejected: it reintroduces exactly the data loss the change removes. A failed patch leaves the file untouched.

## Consequences

- A hand-edited file stays byte-identical until the app changes one of its entities.
- An entity the app changes is still written in the app's own form: comments and unknown fields inside that entity are lost. Unknown fields in entities the app does not touch survive.
- Before writing, the patched text is checked against the delta: it must parse, hold exactly the expected entities, carry the database's content for every entity the delta touched under the database's parent, and keep every other entity where and as it was in the file (byte-identical, or the same own content when a descendant was touched), with nothing new besides entities in their containers. Otherwise nothing is written and the file is reported as a write problem. A splicing bug therefore degrades to "the file did not change", never to a corrupted file. The check reads YAML structure only; it does not replay the file through import → export, which cost several times the export itself on large workspaces.
- The base of a file is the database's export after the file was imported or last written, so a file is replayed through a scratch database only when that base is not cached: the stale-database write at startup, which runs before the import, or a file evicted from the small per-watcher cache.
- Entity order in the file is the author's, not the database's. The UI order lives in `meta.sortKey`, which is patched in place. A new entity is inserted after its predecessor in the export (or before its successor), so a file in canonical form stays byte-identical to what the whole-file export would write, and versions that still rewrite the whole file see no change.
- An entity the exporter does not reproduce — a private sub-environment, a second cookie jar — exists in the file and in the database but on neither side of the delta, so editing or deleting it in the app does not reach the file. It used to be dropped by the whole-file rewrite.
- `isUndiscardableChange` and its "this change cannot be discarded" warning are gone: no change is undiscardable any more. For a file already at the current schema, discarding writes the staged bytes unchanged and the following flush has an empty delta, so the change sticks. A file written by an older schema is migrated by the discard itself (`GitVCS.discardChanges` writes `migrateToLatestYaml(stage, workdir)`), but the changes list compares the migrated HEAD with the working copy through `hasSignificantChanges`, so the migration does not show up as a change.
- A file that cannot be patched keeps its bytes and its database change is retried on every flush, with the file reported as a write problem in the UI.
