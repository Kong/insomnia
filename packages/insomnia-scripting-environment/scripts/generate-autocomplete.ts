// Regenerate src/autocomplete-snippets.json from the live scripting API.
// Run from the package root: npm run generate:autocomplete
//
// This script instantiates the scripting classes in Node.js (where tough-cookie is fine)
// and walks the object graph to derive autocomplete snippets. The output is committed as a
// static JSON file so the renderer never has to import the scripting classes.
//
// Re-run this script whenever the public scripting API surface changes.

import { writeFileSync } from 'node:fs';
import path from 'node:path';

// Import directly from source files to avoid pulling in send-request.ts (which
// transitively imports the Electron-only libcurl native addon via the main package).
const { CookieObject } = require('../src/objects/cookies.ts');
const { Environment, Variables, Vault } = require('../src/objects/environments.ts');
const { Execution } = require('../src/objects/execution.ts');
const { InsomniaObject } = require('../src/objects/insomnia.ts');
const { Request: ScriptRequest } = require('../src/objects/request.ts');
const { RequestInfo } = require('../src/objects/request-info.ts');
const { Response: ScriptResponse } = require('../src/objects/response.ts');
const { Url } = require('../src/objects/urls.ts');
const { ParentFolders } = require('../src/objects/folders.ts');

interface Snippet {
  displayValue: string;
  name: string;
  value: string;
}

function walk(obj: object, path: string): Snippet[] {
  let snippets: Snippet[] = [];
  const refs = new Set<unknown>();
  const record = obj as Record<string, unknown>;

  for (const key in obj) {
    if (key.startsWith('_')) {
      continue;
    }

    const value = record[key];

    if (typeof value === 'object' && value !== null) {
      if (refs.has(value)) {
        continue;
      }
      refs.add(value);
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      snippets.push({ displayValue: `${path}.${value}`, name: `${path}.${key}`, value: `${path}.${key}` });
    } else if (typeof value === 'function') {
      snippets.push({ displayValue: `${path}.${key}()`, name: `${path}.${key}()`, value: `${path}.${key}()` });
    } else if (Array.isArray(value)) {
      for (const item of value) {
        snippets = snippets.concat(walk(item, `${path}.${key}`));
      }
    } else if (value !== null && typeof value === 'object') {
      snippets = snippets.concat(walk(value as object, `${path}.${key}`));
    }
  }

  return snippets;
}

const settings: any = { enableVaultInScripts: true };
const req = new ScriptRequest({ url: new Url('http://placeholder.com') });

const insomnia = new InsomniaObject({
  globals: new Environment('globals', {}),
  baseGlobals: new Environment('baseGlobals', {}),
  iterationData: new Environment('iterationData', {}),
  environment: new Environment('environment', {}),
  baseEnvironment: new Environment('baseEnvironment', {}),
  variables: new Variables({
    baseGlobalVars: new Environment('baseGlobals', {}),
    globalVars: new Environment('globals', {}),
    environmentVars: new Environment('environment', {}),
    collectionVars: new Environment('collection', {}),
    iterationDataVars: new Environment('data', {}),
    folderLevelVars: [],
    localVars: new Environment('data', {}),
  }),
  vault: new Vault('vault', {}, true),
  request: req,
  response: new ScriptResponse({
    code: 200,
    reason: 'OK',
    header: [
      { key: 'header1', value: 'val1' },
      { key: 'header2', value: 'val2' },
    ],
    cookie: [
      { key: 'header1', value: 'val1' },
      { key: 'header2', value: 'val2' },
    ],
    body: '{"key": 888}',
    stream: undefined,
    responseTime: 100,
    originalRequest: req,
  }),
  settings,
  clientCertificates: [],
  cookies: new CookieObject({
    _id: '',
    type: 'CookieJar',
    parentId: '',
    modified: 0,
    created: 0,
    isPrivate: false,
    name: '',
    cookies: [],
  }),
  requestInfo: new RequestInfo({
    eventName: 'prerequest',
    iteration: 1,
    iterationCount: 1,
    requestName: '',
    requestId: '',
  }),
  execution: new Execution({ location: ['path'] }),
  parentFolders: new ParentFolders([]),
});

const snippets = walk(insomnia, 'insomnia');

const outputPath = path.join(__dirname, '../src/autocomplete-snippets.json');
writeFileSync(outputPath, JSON.stringify(snippets, null, 2) + '\n');
console.log(`Wrote ${snippets.length} snippets to src/autocomplete-snippets.json`);
