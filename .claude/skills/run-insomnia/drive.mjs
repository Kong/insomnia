/**
 * Thin CLI client for driver.mjs.
 *
 *   node .claude/skills/run-insomnia/drive.mjs <op> ['<json args>']
 *
 * Examples:
 *   node drive.mjs launch
 *   node drive.mjs snapshot
 *   node drive.mjs click '{"target":{"role":"button","name":"Send"}}'
 *   node drive.mjs db '{"type":"Request","fields":["_id","name","url"]}'
 *
 * Prints the driver's JSON response. Exits non-zero when the op failed, so it
 * composes with `&&` in shell pipelines.
 */
const [, , op, rawArgs] = process.argv;

if (!op) {
  console.error("usage: node drive.mjs <op> ['<json>']");
  process.exit(2);
}

const port = process.env.DRIVER_PORT || 9800;

let args = {};
if (rawArgs) {
  // `exec` takes a script path directly: `drive.mjs exec tmp/flow.ts` - no JSON,
  // no shell escaping. Anything starting with `{` is still parsed as JSON args.
  if (op === 'exec' && !rawArgs.trimStart().startsWith('{')) {
    args = { file: rawArgs };
  } else {
    try {
      args = JSON.parse(rawArgs);
    } catch (e) {
      console.error('args must be valid JSON: ' + e.message);
      process.exit(2);
    }
  }
}

const res = await fetch('http://127.0.0.1:' + port + '/' + op, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(args),
}).catch(e => {
  console.error('cannot reach driver on port ' + port + ' (' + e.message + '). Is driver.mjs running?');
  process.exit(3);
});

const json = await res.json();

// `snapshot` is YAML; printing it raw keeps it readable instead of JSON-escaped.
if (json.ok && typeof json.snapshot === 'string') {
  console.log(json.snapshot);
} else {
  // exec's `log()` output first, as plain lines - that is the script talking.
  if (Array.isArray(json.logs) && json.logs.length && op === 'exec') {
    for (const line of json.logs) {
      console.log(line);
    }
    const { logs: _logs, ...rest } = json;
    console.log(JSON.stringify(rest, null, 2));
  } else {
    console.log(JSON.stringify(json, null, 2));
  }
}

process.exit(json.ok ? 0 : 1);
