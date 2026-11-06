# Insomnia

The desktop app: an API client whose projects can be stored in a Git repository as YAML files.

## Language

**Insomnia file**:
A v5 YAML file at the root of a Git repository that holds one workspace and its contents.
_Avoid_: workspace file, YAML document, export

**Entity**:
Anything inside an Insomnia file that carries `meta.id`: the workspace, folders, requests, environments, cookie jars, specs, mock routes, test suites.
_Avoid_: node, item, object, resource

**Canonical form**:
What Insomnia writes for a given file: the export of the file's import. Anything else — comments, indentation, unknown fields, hand-ordered entries — is form the file's author chose.
_Avoid_: normalized, formatted, round-tripped

**Base** (of a file):
The canonical form of the file as it is on disk, ie. that file as the database sees it.
_Avoid_: snapshot, baseline, previous version

**Delta**:
The entities and root fields that differ between a file's base and the database. It describes what Insomnia itself changed, not what the file's author changed.
_Avoid_: diff, changes, patch

**Patch**:
Applying a delta to the original file text by replacing, inserting or deleting only the affected entities.
_Avoid_: rewrite, regenerate, overwrite, sync
