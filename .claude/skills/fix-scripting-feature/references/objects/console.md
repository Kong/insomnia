# Console

**Source:** `packages/insomnia-scripting-environment/src/objects/console.ts`

## Purpose
Implements a sandbox-safe replacement for the global `console` object used inside pre-request/after-response/test scripts. Instead of writing to a real stdout/devtools console, every call is captured into an in-memory row buffer that the execution harness later dumps and surfaces back to the Insomnia app (e.g. the response timeline).

## Public API

### `type LogLevel`
```ts
type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error';
```
Not exported — internal tag for which console method produced a row.

### `interface Row`
```ts
export interface Row {
  value: string;
  name: string;
  timestamp: number;
}
```
- `value` — the rendered `"<level>: <content>"` string.
- `name` — always `'Text'` in current usage.
- `timestamp` — `Date.now()` at log time.

### `class Console`
No explicit constructor (uses field initializers); instantiated with `new Console()`.

- `rows: Row[]` — accumulated log entries, in call order.
- `printLog = (rows: Row[], level: LogLevel, ...values: any) => void` — core formatter (marked `@ignore`, not really meant to be called directly by users). Maps each value to a string (`typeof value === 'string' ? value : JSON.stringify(value, null, 2)`), joins with `' '`, and pushes `{ value: `${level}: ${content}`, name: 'Text', timestamp: Date.now() }` onto `rows`. If formatting throws, it instead pushes a row whose `value` is `'error: ' + JSON.stringify(e, null, 2)`.
- `log = (...values: any[]) => void` — calls `printLog(this.rows, 'log', ...values)`.
- `warn = (...values: any[]) => void` — calls `printLog(this.rows, 'warn', ...values)`.
- `debug = (...values: any[]) => void` — calls `printLog(this.rows, 'debug', ...values)`.
- `info = (...values: any[]) => void` — calls `printLog(this.rows, 'info', ...values)`.
- `error = (...values: any[]) => void` — calls `printLog(this.rows, 'error', ...values)`.
- `clear = (_level: LogLevel, _message?: any, ..._optionalParams: any[]) => void` — **always throws** `new Error('currently "clear" is not supported for the timeline')`. Calling `console.clear()` in a script will throw.
- `dumpLogs = () => string` — returns all rows serialized as `JSON.stringify(row) + '\n'`, joined with `'\n'` (i.e. one JSON blob per row, double-newline separated).
- `dumpLogsAsArray = () => string[]` — same per-row serialization (`JSON.stringify(row) + '\n'`) but returned as an array instead of one joined string.

### Module-level singleton helpers
- `let builtInConsole = new Console();` (module-private).
- `getExistingConsole(): Console` — returns the current singleton without creating a new one.
- `getNewConsole(): Console` — replaces the singleton with a fresh `new Console()` and returns it (used to reset log state between script executions).

## Script-facing surface
- `console.log(...)`, `console.warn(...)`, `console.debug(...)`, `console.info(...)`, `console.error(...)` — available as the script's global `console` inside pre-request/after-response/test scripts (the sandbox injects a `Console` instance as the `console` parameter, not the real JS console).
- `console.clear()` — present but always throws if called from a script.

## Gotchas / notable behavior
- **`clear()` is a hard error, not a no-op.** Any script calling `console.clear()` will throw `Error('currently "clear" is not supported for the timeline')`, which will surface as a script failure.
- **Object logging uses `JSON.stringify(value, null, 2)`**, not `util.inspect`-style formatting — circular references or values with `toJSON()` quirks will affect what shows up. If `JSON.stringify` itself throws (e.g. circular reference), the whole `printLog` call falls back to a single `'error: ' + JSON.stringify(e, null, 2)` row rather than losing the log entirely — but the original values are lost in that fallback.
- **No format-string substitution (`%s`, `%d`, etc.)** — the `// TODO: support replacing substitution` comment confirms this isn't implemented; values are just stringified and space-joined.
- **State is a module-level singleton**, not per-instance-only: `getExistingConsole()`/`getNewConsole()` share one `builtInConsole` variable across the module. The harness must call `getNewConsole()` before each script run to avoid leaking log rows from a previous execution into the next one's dump.
- **Two different dump shapes exist** (`dumpLogs()` joined string vs. `dumpLogsAsArray()` array of strings) — different call sites in the harness use one or the other (see Related), so a log line "disappearing" could be a symptom of reading from the wrong dump method or a stale singleton reference.

## Related
- `packages/insomnia-scripting-environment/src/objects/insomnia.ts` — imports `getExistingConsole` and uses it only for a one-off warning log during `initInsomniaObject` (an empty-certificate warning); it is not the general per-script logging path.
- `packages/insomnia/src/scripting/sandbox.ts` (`prepareSandbox`) — calls `getNewConsole()` to obtain a fresh `Console` instance for each script run and passes `scriptConsole.log` into `initInsomniaObject(sandboxContext, scriptConsole.log)`.
- `packages/insomnia/src/scripting/run-script.ts` — injects the `Console` instance itself as the sandboxed script's `console` global (part of the generated function's parameter list), and at the end calls `scriptConsole.dumpLogsAsArray()`, including the result (`logs`) in the returned `RequestContext`.
- Legacy path `packages/insomnia/src/script-executor.ts` — calls `scriptConsole.dumpLogs()` (joined-string form) and appends it to a timeline file via `fs.promises.appendFile`, which is how logs end up in Insomnia's response timeline view in that code path.
