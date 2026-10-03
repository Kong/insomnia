import { services } from 'insomnia-data';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import * as importUtil from '../import';
import { getInsomniaV5DataExport } from '../insomnia-v5';
import { getRenderedRequestAndContext } from '../render';

const getRenderedRequest = async (args: Parameters<typeof getRenderedRequestAndContext>[0]) =>
  (await getRenderedRequestAndContext(args)).request;

// An imported collection's cookie jar never carries Insomnia's `source` field -- it's an
// Insomnia-internal concept that no import format (Postman, HAR, curl, or even Insomnia's own
// v5 CookieSchema) writes out. This is accepted, documented behavior (see the migration comment
// in insomnia-data/node-src/database/init-model/cookie-jar.ts): importing a collection already
// means trusting it with sandboxed script execution, so a template value arriving via an
// imported cookie is not a new capability an attacker doesn't already have from a malicious
// pre-request script in the same file. This pins that decision down as a regression test.
describe('cookie source tagging on import', () => {
  const templateValue = "{% uuid 'v4' %}";

  const buildV5Export = () =>
    stringify({
      type: 'collection.insomnia.rest/5.0',
      name: 'Imported Collection',
      cookieJar: {
        name: 'Imported Jar',
        // no `source` on this cookie -- matches every real import format
        cookies: [
          {
            key: 'session',
            value: templateValue,
            domain: 'localhost',
            path: '/',
          },
        ],
      },
      collection: [
        {
          name: 'Get',
          url: 'http://localhost',
          method: 'GET',
        },
      ],
    });

  it('tags an imported cookie missing `source` as manual', async () => {
    const project = await services.project.create();
    await importUtil.scanResources([{ contentStr: buildV5Export() }]);
    await importUtil.importResourcesToProject({ projectId: project._id });

    const [workspace] = await services.workspace.listByParentId(project._id);
    const cookieJar = await services.cookieJar.getOrCreateForParentId(workspace._id);
    const cookie = cookieJar.cookies.find(c => c.key === 'session');

    expect(cookie?.source).toBe('manual');
  });

  it('renders a template value from an imported cookie, same as a manually-authored one', async () => {
    const project = await services.project.create();
    await importUtil.scanResources([{ contentStr: buildV5Export() }]);
    await importUtil.importResourcesToProject({ projectId: project._id });

    const [workspace] = await services.workspace.listByParentId(project._id);
    const [importedRequest] = await services.request.findByParentId(workspace._id);

    const renderedRequest = await getRenderedRequest({ request: importedRequest });
    const renderedCookie = renderedRequest.cookieJar.cookies.find(c => c.key === 'session');

    expect(renderedCookie?.value).not.toBe(templateValue);
    expect(renderedCookie?.value).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// Insomnia's own v5 format can now carry `source` explicitly (export writes it, the import
// schema validates it), so an Insomnia-to-Insomnia round-trip preserves the manual/response
// distinction instead of flattening everything to 'manual' like every other import format still
// does. A malformed or foreign `source` value must fall back to that same grandfather-to-manual
// default rather than crash the import.
describe('cookie source round-trip for the Insomnia v5 format', () => {
  const templateValue = "{% uuid 'v4' %}";

  const buildV5ExportWithSource = (source: unknown) =>
    stringify({
      type: 'collection.insomnia.rest/5.0',
      name: 'Imported Collection',
      cookieJar: {
        name: 'Imported Jar',
        cookies: [
          { key: 'session', value: templateValue, domain: 'localhost', path: '/', source },
        ],
      },
      collection: [{ name: 'Get', url: 'http://localhost', method: 'GET' }],
    });

  const importAndRender = async (contentStr: string) => {
    const project = await services.project.create();
    await importUtil.scanResources([{ contentStr }]);
    await importUtil.importResourcesToProject({ projectId: project._id });

    const [workspace] = await services.workspace.listByParentId(project._id);
    const cookieJar = await services.cookieJar.getOrCreateForParentId(workspace._id);
    const [importedRequest] = await services.request.findByParentId(workspace._id);

    const renderedRequest = await getRenderedRequest({ request: importedRequest });
    return {
      persistedSource: cookieJar.cookies.find(c => c.key === 'session')?.source,
      renderedValue: renderedRequest.cookieJar.cookies.find(c => c.key === 'session')?.value,
    };
  };

  it('honors an explicit response source and does not render it', async () => {
    const { persistedSource, renderedValue } = await importAndRender(buildV5ExportWithSource('response'));

    expect(persistedSource).toBe('response');
    expect(renderedValue).toBe(templateValue);
  });

  it('honors an explicit manual source and renders it', async () => {
    const { persistedSource, renderedValue } = await importAndRender(buildV5ExportWithSource('manual'));

    expect(persistedSource).toBe('manual');
    expect(renderedValue).not.toBe(templateValue);
    expect(renderedValue).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ['an unrecognized string', 'bogus'],
    ['a number', 12_345],
    ['an object', { nested: 'garbage' }],
  ])('falls back to the manual grandfather default for %s source value', async (_label, malformedSource) => {
    const { persistedSource, renderedValue } = await importAndRender(buildV5ExportWithSource(malformedSource));

    expect(persistedSource).toBe('manual');
    expect(renderedValue).not.toBe(templateValue);
  });

  it('preserves manual vs response tags across an Insomnia-to-Insomnia export/import round-trip', async () => {
    const sourceProject = await services.project.create();
    const sourceWorkspace = await services.workspace.create({ parentId: sourceProject._id, scope: 'collection' });
    await services.environment.getOrCreateForParentId(sourceWorkspace._id);
    await services.request.create({ parentId: sourceWorkspace._id, url: 'http://localhost', method: 'GET' });
    const sourceCookieJar = await services.cookieJar.getOrCreateForParentId(sourceWorkspace._id);
    await services.cookieJar.update(sourceCookieJar, {
      cookies: [
        { id: 'c1', key: 'tracking', value: templateValue, expires: null, domain: 'localhost', path: '/', secure: false, httpOnly: false, source: 'response' },
        { id: 'c2', key: 'session', value: templateValue, expires: null, domain: 'localhost', path: '/', secure: false, httpOnly: false, source: 'manual' },
      ],
    });

    const exported = await getInsomniaV5DataExport({ workspaceId: sourceWorkspace._id, includePrivateEnvironments: true });

    const destProject = await services.project.create();
    await importUtil.scanResources([{ contentStr: exported }]);
    await importUtil.importResourcesToProject({ projectId: destProject._id });

    const [destWorkspace] = await services.workspace.listByParentId(destProject._id);
    const destCookieJar = await services.cookieJar.getOrCreateForParentId(destWorkspace._id);
    const [destRequest] = await services.request.findByParentId(destWorkspace._id);

    expect(destCookieJar.cookies.find(c => c.key === 'tracking')?.source).toBe('response');
    expect(destCookieJar.cookies.find(c => c.key === 'session')?.source).toBe('manual');

    const renderedRequest = await getRenderedRequest({ request: destRequest });
    expect(renderedRequest.cookieJar.cookies.find(c => c.key === 'tracking')?.value).toBe(templateValue);
    expect(renderedRequest.cookieJar.cookies.find(c => c.key === 'session')?.value).not.toBe(templateValue);
  });
});
