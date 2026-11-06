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
- Before writing, the patched text is replayed through import → export and must produce the database's delta-free state; otherwise nothing is written and the file is reported as a write problem. A splicing bug therefore degrades to "the file did not change", never to a corrupted file.
- Entity order in the file is the author's, not the database's. The UI order lives in `meta.sortKey`, which is patched in place.
- An entity the exporter does not reproduce — a private sub-environment, a second cookie jar — exists in the file and in the database but on neither side of the delta, so editing or deleting it in the app does not reach the file. It used to be dropped by the whole-file rewrite.
- `isUndiscardableChange` and its "this change cannot be discarded" warning are gone. For a file already at the current schema, discarding writes the staged bytes unchanged and the following flush has an empty delta, so the change sticks. A file written by an older schema is still migrated by the discard itself (`GitVCS.discardChanges` writes `migrateToLatestYaml(stage, workdir)`), so its formatting change reappears until it is committed once; that case is no longer called out in the UI.
- A file that cannot be patched keeps its bytes and its database change is retried on every flush, with the file reported as a write problem in the UI.
