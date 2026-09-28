// Sensitive value collection and redaction for timeline files written to disk.
//
// Data flow (HTTP send path):
//
//   sendActionImplementation
//     │ createSensitiveValueCollector(hideSecretValuesInPreviewAndConsole)
//     │ collectConfidentialRawValues(...) pre-fills the collector with every isConfidential:true
//     │   KV pair's raw value across all five environment layers, before any render happens.
//     │   This covers early-exit paths (pre-request script throws, skipRequest) where the
//     │   normal render-time registration below never runs.
//     ↓
//   tryToInterpolateRequest → getRenderedRequestAndContext → getRenderContext
//     │  buildRenderContext registers three value categories into the collector:
//     │    ① normal confidential env vars   (isConfidential: true, STRING/JSON KV pairs)
//     │    ② decrypted SECRET vault values   (maskOrDecryptVaultDataIfNecessary)
//     │    ③ external vault tag results      (liquid-extension.ts ext.run() return value)
//     ↓
//   withRedaction(runtime, collector) wraps appendTimeline/appendTimelineOnError:
//     logs.map(line => collector.redact(line))   ← replaces every registered value with ••••••
//     ↓
//   sendCurlAndWriteTimeline, and pre-/after-response script console logs
//   (tryToExecuteScript → runtime.appendTimeline / runtime.appendTimelineOnError) →
//   timeline lines written to disk are already redacted.
//
// Pre-/after-response scripts also decrypt global-vault secrets via
// maskOrDecryptVaultDataIfNecessary({ ..., sensitiveValueCollector }) inside tryToExecuteScript,
// so those register into the same collector before their console.log output is written.
//
// WebSocket/SocketIO timeline redaction is deferred to a follow-up phase (T10).

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';
import type { SensitiveValueCollector } from '~/common/templating/types';
import type { SendActionRuntime } from '~/network/network';


export type { SensitiveValueCollector };

export function withRedaction(
  runtime: SendActionRuntime,
  collector: SensitiveValueCollector | null,
): SendActionRuntime {
  if (!collector) {
    return runtime;
  }

  return {
    appendTimeline: (timelinePath, logs) => runtime.appendTimeline(timelinePath, logs.map(line => collector.redact(line))),
    appendTimelineOnError: (timelinePath, data) => runtime.appendTimelineOnError(timelinePath, collector.redact(data)),
  };
}

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
  // Longest-first so a short value (e.g. "abc") can't consume part of a longer
  // value that contains it (e.g. "abc-secret-xyz") before the longer one is matched.
  const sortedValues = [...values].sort((a, b) => b.length - a.length);

  let result = text;
  for (const val of sortedValues) {
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

  const values = new Set<string>();

  return {
    register(value: string): void {
      if (value.length > 0) {
        values.add(value);
      }
    },
    redact(text: string): string {
      return redactConfidentialText(text, [...values]);
    },
    get isEmpty() {
      return values.size === 0;
    },
  };
}
