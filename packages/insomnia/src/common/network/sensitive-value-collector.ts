// Sensitive value collection and redaction for timeline files written to disk.
//
// Data flow (HTTP send path):
//
//   sendActionImplementation
//     │ createSensitiveValueCollector(hideSecretValuesInPreviewAndConsole)
//     ↓
//   tryToInterpolateRequest → getRenderedRequestAndContext → getRenderContext
//     │  buildRenderContext registers three value categories into the collector:
//     │    ① normal confidential env vars   (isConfidential: true, STRING/JSON KV pairs)
//     │    ② decrypted SECRET vault values   (maskOrDecryptVaultDataIfNecessary)
//     │    ③ external vault tag results      (liquid-extension.ts ext.run() return value)
//     ↓
//   redactingRuntime.appendTimeline wraps the real appendTimeline:
//     logs.map(line => collector.redact(line))   ← replaces every registered value with ••••••
//     ↓
//   sendCurlAndWriteTimeline → timeline lines written to disk are already redacted
//
// Script console redaction (pre/after-response scripts) and WebSocket/SocketIO
// timeline redaction are deferred to a follow-up phase.

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';
import type { SensitiveValueCollector } from '~/common/templating/types';


export type { SensitiveValueCollector };

export function collectLeafStrings(value: any, collector: SensitiveValueCollector): void {
  if (typeof value === 'string') {
    collector.register(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectLeafStrings(item, collector);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) {
      collectLeafStrings(v, collector);
    }
  }
}

export function redactConfidentialText(text: string, values: readonly string[]): string {
  let result = text;
  for (const val of values) {
    if (val.length === 0) {
      continue;
    }
    // MVP: raw string replacement only.
    // TODO: also replace URL-encoded (%XX) and JSON-escaped (\uXXXX) variants.
    result = result.replaceAll(val, CONFIDENTIAL_MASK_VALUE);
  }
  return result;
}

export function createSensitiveValueCollector(hideSecretValues: boolean): SensitiveValueCollector | null {
  if (!hideSecretValues) {
    return null;
  }

  const values: string[] = [];

  return {
    register(value: string): void {
      if (value.length > 0 && !values.includes(value)) {
        values.push(value);
      }
    },
    redact(text: string): string {
      return redactConfidentialText(text, values);
    },
    get isEmpty() {
      return values.length === 0;
    },
  };
}
