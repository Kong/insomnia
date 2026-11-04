import { isMap, isNode, isScalar, LineCounter, parseDocument } from 'yaml';
import type { z } from 'zod/v4';

import { checkStrictSchemaMatch } from './check-schema-mismatch';

export interface UnknownFieldRange {
  startLine: number;
  endLine: number;
  // Short name of what is unrecognized: the field name, or the path for other mismatches.
  label: string;
  message: string;
}

export function findUnknownFieldRanges(yamlText: string, schema: z.ZodTypeAny): UnknownFieldRange[] {
  try {
    const lineCounter = new LineCounter();
    const yamlDocument = parseDocument(yamlText, { lineCounter });
    if (yamlDocument.errors.length > 0) {
      return [];
    }

    const document = yamlDocument.toJS();
    // Repos can hold unrelated YAML (e.g. OpenAPI specs); only Insomnia files are relevant.
    if (!schema.safeParse(document).success) {
      return [];
    }

    const { errors } = checkStrictSchemaMatch(schema, document);

    const ranges = new Map<string, UnknownFieldRange>();
    const addRange = (range: readonly [number, number, number] | null | undefined, label: string, message: string) => {
      if (!range) {
        return;
      }
      const startLine = lineCounter.linePos(range[0]).line;
      // `range[1]` is the offset right after the node, which can sit on the next line after a trailing newline.
      const endLine = lineCounter.linePos(Math.max(range[0], range[1] - 1)).line;
      const key = `${startLine}-${endLine}`;
      if (!ranges.has(key)) {
        ranges.set(key, { startLine, endLine, label, message });
      }
    };

    for (const error of errors) {
      // The document already passed the non-strict schema above, so unknown keys are the only possible real mismatch.
      // Any other issue comes from a `z.union` branch the node does not belong to -- zod reports every branch, so e.g.
      // a `spec: { contents }` also yields "spec.file: expected string" from the `spec: { file }` branch. Highlighting
      // those would mark nodes that are perfectly valid.
      if (!error.keys) {
        continue;
      }
      const parent = yamlDocument.getIn(error.pathSegments as (string | number)[], true);
      if (!isMap(parent)) {
        continue;
      }
      for (const unknownKey of error.keys) {
        const pair = parent.items.find(item => isScalar(item.key) && item.key.value === unknownKey);
        if (!pair || !isNode(pair.key)) {
          continue;
        }
        // Highlight from the key through the end of its value, so nested unknown objects are covered fully.
        const valueRange = isNode(pair.value) ? pair.value.range : null;
        addRange(
          [pair.key.range![0], (valueRange ?? pair.key.range!)[1], (valueRange ?? pair.key.range!)[2]],
          unknownKey,
          `Unrecognized field "${unknownKey}": fields that were added by a newer version of Insomnia, or manual file edits.`,
        );
      }
    }

    return [...ranges.values()].sort((a, b) => a.startLine - b.startLine);
  } catch {
    return [];
  }
}
