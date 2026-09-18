import { models, services } from 'insomnia-data';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import * as importUtil from '../import';
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
