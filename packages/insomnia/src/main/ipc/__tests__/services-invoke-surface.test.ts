import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  describeServicesInvokeSurface,
  findPairsMissingNamedHandler,
  formatServicesInvokeSurfaceEntries,
} from '../services-invoke-surface';

describe('describeServicesInvokeSurface (fixture tree)', () => {
  let rendererRoot: string;

  beforeEach(() => {
    rendererRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'services-invoke-surface-'));
  });

  afterEach(() => {
    fs.rmSync(rendererRoot, { recursive: true, force: true });
  });

  const write = (relPath: string, contents: string) => {
    const abs = path.join(rendererRoot, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents, 'utf8');
  };

  it('finds a renderer call site and records its file, defaulting hasNamedHandler to false', () => {
    write('routes/thing.tsx', "await services.request.getById(id);\n");
    fs.mkdirSync(path.join(rendererRoot, 'main', 'ipc'), { recursive: true });

    const entries = describeServicesInvokeSurface({ rendererRoot });
    expect(entries).toEqual([
      { pair: 'request.getById', serviceName: 'request', methodName: 'getById', callSiteFiles: ['routes/thing.tsx'], hasNamedHandler: false },
    ]);
  });

  it('marks a pair migrated once a matching ipcMainHandle("services.<x>.<y>", ...) exists under mainIpcDir', () => {
    write('routes/thing.tsx', "await services.request.getById(id);\n");
    write('main/ipc/main.ts', "ipcMainHandle('services.request.getById', async (_, id) => services.request.getById(id));\n");

    const entries = describeServicesInvokeSurface({ rendererRoot, mainIpcDir: path.join(rendererRoot, 'main', 'ipc') });
    expect(entries).toEqual([
      { pair: 'request.getById', serviceName: 'request', methodName: 'getById', callSiteFiles: ['routes/thing.tsx'], hasNamedHandler: true },
    ]);
    expect(findPairsMissingNamedHandler({ rendererRoot, mainIpcDir: path.join(rendererRoot, 'main', 'ipc') })).toEqual([]);
  });

  it('does not treat an incidental services.<x>.<y>(...) call under main/ as a named handler', () => {
    // Mirrors the real repo's `database.caCertificate.create` handler: it calls
    // `services.caCertificate.create(...)` in-process, but is registered under a differently-named
    // channel, so it proves nothing about whether the renderer's own call site has migrated.
    write('routes/cacert.tsx', "await services.caCertificate.create(patch);\n");
    write('main/ipc/main.ts', "ipcMainHandle('database.caCertificate.create', async (_, options) => services.caCertificate.create(options));\n");

    const entries = describeServicesInvokeSurface({ rendererRoot, mainIpcDir: path.join(rendererRoot, 'main', 'ipc') });
    expect(entries).toEqual([
      { pair: 'caCertificate.create', serviceName: 'caCertificate', methodName: 'create', callSiteFiles: ['routes/cacert.tsx'], hasNamedHandler: false },
    ]);
  });

  it('excludes the main/ subtree, test files, and scaffolding directories from the renderer call-site scan', () => {
    write('main/ipc/other.ts', "await services.settings.patch(patch);\n");
    write('routes/thing.test.tsx', "await services.settings.patch(patch);\n");
    write('routes/__tests__/thing.tsx', "await services.settings.patch(patch);\n");
    write('routes/__mocks__/thing.tsx', "await services.settings.patch(patch);\n");
    write('node_modules/dep/index.ts', "await services.settings.patch(patch);\n");
    write('templating/sandbox/vendored/pkg/index.ts', "await services.settings.patch(patch);\n");
    write('routes/real-call-site.tsx', "await services.settings.get();\n");

    const entries = describeServicesInvokeSurface({ rendererRoot });
    expect(entries).toEqual([
      { pair: 'settings.get', serviceName: 'settings', methodName: 'get', callSiteFiles: ['routes/real-call-site.tsx'], hasNamedHandler: false },
    ]);
  });

  it('aggregates multiple call sites for the same pair and sorts pairs and files deterministically', () => {
    write('routes/b.tsx', "services.request.getById(id);\n");
    write('routes/a.tsx', "services.request.getById(id);\n");
    write('routes/c.tsx', "services.environment.getById(id);\n");

    const entries = describeServicesInvokeSurface({ rendererRoot });
    expect(entries.map(e => e.pair)).toEqual(['environment.getById', 'request.getById']);
    expect(entries.find(e => e.pair === 'request.getById')?.callSiteFiles).toEqual(['routes/a.tsx', 'routes/b.tsx']);
  });
});

describe('describeServicesInvokeSurface (real repo)', () => {
  // Snapshot, not a pass/fail gate: intentionally shows the current migration state, so any change —
  // a newly added call site, or a pair moving off the generic gateway onto a named handler — surfaces
  // as a diff in review rather than silently drifting.
  it('matches the current services.invoke surface snapshot', () => {
    const entries = describeServicesInvokeSurface();
    expect(entries.length).toBeGreaterThan(0);
    expect(formatServicesInvokeSurfaceEntries(entries)).toMatchSnapshot();
  });
});
