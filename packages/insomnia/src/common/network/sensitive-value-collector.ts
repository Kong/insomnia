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
// tryToExecuteScript also calls registerConfidentialValues on the script's *output* data
// right before writing that script's logs, so a value the script itself wrote into a
// confidential key (insomnia.environment.set('token', ...)) is redacted too. The pre-fill
// above only saw the values that existed before the script ran, and an after-response
// script is followed by no render at all.
//
// Pre-/after-response scripts also decrypt global-vault secrets via
// maskOrDecryptVaultDataIfNecessary({ ..., sensitiveValueCollector }) inside tryToExecuteScript,
// so those register into the same collector before their console.log output is written.
//
// WebSocket/SocketIO/SSE/MCP timeline & event-log redaction (T10) works differently, because those
// writes happen in the main process, outside any SendActionRuntime/appendTimeline abstraction:
//   renderer: tryToInterpolateRequestAndCollectSensitiveValues / renderRealtimeConnectPayload build a
//     collector the same way, then read collector.values (a snapshot array) and send it over IPC
//     alongside the already-rendered request (webSocket.open/event.send, socketIO.open/event.send,
//     curl.open, mcp.connect). Setting OFF ⇒ collector is null ⇒ an empty array is sent ⇒ main
//     redacts nothing.
//   main: websocket.ts/socket-io.ts/curl.ts keep a Map<requestId, Set<string>>, mcp/common.ts keeps
//     a Set<string> on ConnectionContext. Opening a connection *replaces* that request's set (MCP
//     builds a fresh ConnectionContext instead); each later send merges its own values in. Replacing
//     matters because a connect that never reaches its cleanup leaves its set behind, and a merge
//     could neither drop those stale values nor empty the set once the setting is off. The set is
//     used to redact every timeline/event-log write before it reaches disk via
//     redactConfidentialText (single-line fields) or redactDeep (nested JSON payloads).
// gRPC Stream tab messages never leave the renderer, so getRenderedGrpcRequestMessage takes a
// sensitiveValueCollector directly and the caller redacts the display-only copy of the text.

import type { RequestTestResult } from 'insomnia-data';

import type { SendActionRuntime } from '~/common/network/send-action-runtime';
import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';
import type { SensitiveValueCollector } from '~/common/templating/types';
import type { ResponsePatch } from '~/main/network/libcurl-promise';


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

// Registers every scalar leaf of `value` that can show up verbatim in a timeline line.
//
// Numbers are registered as `String(value)`: a confidential JSON variable like
// `{ "pin": 1234 }` renders into the request as `1234`, so skipping numeric leaves would
// leave that secret in plaintext on disk.
//
// Booleans and null are skipped: `true`/`false`/`null` carry no secrecy of their own and
// registering them would mangle unrelated JSON in the timeline. Non-finite numbers
// (NaN/Infinity) are skipped for the same reason.
//
// Short numeric leaves (`1`, `0`) still over-redact aggressively -- every occurrence of that
// digit in the timeline is replaced. That is the same trade-off already accepted for short
// strings: over-redaction is preferred over a silent "short secrets are unprotected" gap.
export function collectLeafValues(value: any, collector: SensitiveValueCollector): void {
  if (typeof value === 'string') {
    collector.register(value);
  } else if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      collector.register(String(value));
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectLeafValues(item, collector);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) {
      collectLeafValues(v, collector);
    }
  }
}

// Response documents are persisted to NeDB without passing through the timeline's
// withRedaction wrapper, so they need redacting at their own write points. Three fields can
// echo a confidential value:
//   - url: the effective URL, with any confidential variable already interpolated into it.
//   - error: most often a script throw. Users concatenate secrets themselves
//     (`throw new Error('auth failed for ' + token)`), chai puts the actual value in its
//     message when `insomnia.expect(token)` fails outside a test block, and V8 echoes its
//     input verbatim for things like `JSON.parse(token)`.
//   - requestTestResults: `testCase` is a user-supplied test name that may concatenate
//     variables, and `errorMessage` embeds chai's ACTUAL/EXPECTED values.
//
// A null collector (the setting is OFF) leaves everything untouched, as everywhere else.
export const redactText = <T extends string | undefined>(text: T, collector: SensitiveValueCollector | null): T =>
  (collector && text !== undefined ? collector.redact(text) : text) as T;

export const redactTestResults = (results: RequestTestResult[], collector: SensitiveValueCollector | null) =>
  collector
    ? results.map(result => ({
      ...result,
      testCase: collector.redact(result.testCase),
      ...(result.errorMessage === undefined ? {} : { errorMessage: collector.redact(result.errorMessage) }),
    }))
    : results;

export type PersistedResponsePatch = ResponsePatch & { requestTestResults?: RequestTestResult[] };

export const redactResponsePatch = (
  patch: PersistedResponsePatch,
  collector: SensitiveValueCollector | null,
): PersistedResponsePatch =>
  collector
    ? {
      ...patch,
      url: redactText(patch.url, collector),
      error: redactText(patch.error, collector),
      ...(patch.requestTestResults === undefined
        ? {}
        : { requestTestResults: redactTestResults(patch.requestTestResults, collector) }),
    }
    : patch;

export function redactConfidentialText(text: string, values: readonly string[]): string {
  // Longest-first so a short value (e.g. "abc") can't consume part of a longer
  // value that contains it (e.g. "abc-secret-xyz") before the longer one is matched.
  const sortedValues = [...values].sort((a, b) => b.length - a.length);

  let result = text;
  for (const val of sortedValues) {
    if (val.length === 0) {
      continue;
    }
    result = result.replaceAll(val, CONFIDENTIAL_MASK_VALUE);
  }
  return result;
}

// A derived credential (base64(user:pass) for Basic Auth) does not contain the plaintext inputs,
// so it never matches the values the renderer registered and has to be registered separately.
// Only do that when an input actually was confidential -- registering it unconditionally would
// mask every Basic Auth header on every surface, including credentials nobody marked.
//
// No need to check the hide setting: with it off nothing is ever registered, so `values` is empty
// and nothing looks confidential.
export function isDerivedFromConfidentialValues(
  values: readonly string[],
  inputs: (string | undefined)[],
): boolean {
  return inputs.some(input => !!input && redactConfidentialText(input, values) !== input);
}

// A registered value rarely reaches disk in its raw form. Timeline lines are written as NDJSON,
// so JSON.stringify escapes `"`, `\` and control characters, and a secret interpolated into a
// URL is percent-encoded by the time curl echoes it back. `replaceAll` is a literal match, so a
// secret like `ab"cd` would survive on disk as `ab\"cd` unless the escaped form is registered too.
//
// Variants that are identical to the raw value (the common case: no quotes, no reserved
// characters) are collapsed by the Set, so this costs nothing for ordinary secrets.
function expandEncodedVariants(value: string): string[] {
  const variants = [value];

  // JSON.stringify always yields a quoted string; strip the surrounding quotes.
  variants.push(JSON.stringify(value).slice(1, -1));

  try {
    variants.push(encodeURIComponent(value));
  } catch {
    // encodeURIComponent throws URIError on a lone surrogate -- nothing to register then.
  }

  return variants.filter(variant => variant.length > 0);
}

// Recursively redacts string leaves of a plain object/array, preserving shape. Used where a field
// (e.g. a WebSocket/MCP message payload) must be redacted *before* JSON.stringify so that quotes,
// backslashes and newlines inside a registered value don't need to match their escaped form.
// Other non-plain-object values (Buffer, ArrayBuffer, class instances, etc.) pass through
// unchanged: they're either binary (nothing to redact) or not the kind of payload this covers.
//
// Errors are the exception. Event-log writers put the raw Error on the event's `error` field, and
// JSON.stringify writes an Error's own *enumerable* properties -- socket.io-client attaches the
// server's handshake data as `err.data` -- so an Error left alone can still put a registered value
// on disk. Every caller only ever JSON.stringify's the result, so a plain object carrying the same
// own enumerable properties serializes identically. A custom `toJSON` would not survive that swap,
// so Errors defining one are left untouched.
export function redactDeep<T>(value: T, values: readonly string[]): T {
  if (typeof value === 'string') {
    return redactConfidentialText(value, values) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => redactDeep(item, values)) as unknown as T;
  }
  if (value instanceof Error) {
    if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
      return value;
    }
    const result: Record<string, any> = {};
    for (const [key, v] of Object.entries(value)) {
      result[key] = redactDeep(v, values);
    }
    return result as unknown as T;
  }
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const result: Record<string, any> = {};
    for (const [key, v] of Object.entries(value)) {
      result[key] = redactDeep(v, values);
    }
    return result as T;
  }
  return value;
}

export function createSensitiveValueCollector(hideSecretValues: boolean): SensitiveValueCollector | null {
  if (!hideSecretValues) {
    return null;
  }

  const values = new Set<string>();

  return {
    register(value: string): void {
      if (value.length > 0) {
        for (const variant of expandEncodedVariants(value)) {
          values.add(variant);
        }
      }
    },
    redact(text: string): string {
      return redactConfidentialText(text, [...values]);
    },
    get isEmpty() {
      return values.size === 0;
    },
    get values() {
      return [...values];
    },
  };
}
