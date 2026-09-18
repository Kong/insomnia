// @ts-nocheck
import * as crypto from 'node:crypto';

import { database, models, services } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { getRenderedRequestAndContext } from '../../common/render';
import { CookieObject, mergeCookieJar } from '../../../../insomnia-scripting-environment/src/objects';

const getRenderedRequest = async (args: Parameters<typeof getRenderedRequestAndContext>[0]) =>
  (await getRenderedRequestAndContext(args)).request;

// A malicious/compromised server can only ever plant a cookie tagged source: 'response'.
// render.ts's fix (PR #10475) excludes those from template rendering. This covers what happens
// to that source tag across a script run: the scripting bridge that EVERY pre-request /
// after-response script run puts the cookie jar through (insomnia-scripting-environment's
// CookieObject + mergeCookieJar) used to drop the tag regardless of whether the script touched
// cookies at all, and network.ts's savePatchesMadeByScript used to relabel any untagged cookie
// as 'manual' (trusted), re-enabling template rendering of a response-planted value. It must
// also not go the other way: a manually-authored cookie's templating must keep working the same
// way across a script run.
describe('cookie templating by source (manual vs response) across a script run', () => {
  const payload = "{{{{{}}{%%os 'userInfo'{{{{%%}{%}";

  it('does not render a response-sourced cookie before any script has run', async () => {
    const workspace = await services.workspace.create();
    const cookieJar = await services.cookieJar.getOrCreateForParentId(workspace._id);
    await services.cookieJar.update(cookieJar, {
      cookies: [
        {
          id: 'c1',
          key: 'poc',
          value: payload,
          domain: 'localhost',
          path: '/',
          secure: false,
          httpOnly: false,
          source: 'response',
        },
      ],
    });

    const request = Object.assign(models.request.init(), {
      _id: 'req_before_script',
      parentId: workspace._id,
      url: 'http://localhost',
    });

    const renderedRequest = await getRenderedRequest({ request });
    const cookie = renderedRequest.cookieJar.cookies.find(c => c.key === 'poc');
    expect(cookie?.value).toBe(payload);
  });

  it('keeps the response source tag through the scripting bridge, even for a no-op script', async () => {
    const workspace = await services.workspace.create();
    const initialJar = await services.cookieJar.getOrCreateForParentId(workspace._id);
    await services.cookieJar.update(initialJar, {
      cookies: [
        {
          id: 'c2',
          key: 'poc',
          value: payload,
          domain: 'localhost',
          path: '/',
          secure: false,
          httpOnly: false,
          source: 'response',
        },
      ],
    });
    // update() returns a patch and does not mutate initialJar in place -- re-fetch to get the
    // cookie we just seeded before feeding it through the bridge below.
    const cookieJar = await services.cookieJar.getOrCreateForParentId(workspace._id);

    // Simulate exactly what happens to the cookie jar on every pre-request / after-response
    // script run (run-script.ts:94, script-executor.ts:69), whether or not the script body
    // ever references insomnia.cookies. No script logic is involved here at all.
    const bridged = new CookieObject(cookieJar).jar().toInsomniaCookieJar();
    const roundTripped = mergeCookieJar(cookieJar, bridged);

    const bridgedCookie = roundTripped.cookies.find(c => c.key === 'poc');
    expect(bridgedCookie?.source).toBe('response'); // <-- tag survives the bridge round-trip

    // This is savePatchesMadeByScript's fail-closed fallback in network.ts: an untagged cookie
    // is only trusted as 'manual' if it's genuinely new (no matching id in the pre-script jar).
    const originalCookieIds = new Set(cookieJar.cookies.map(c => c.id));
    const relabeled = roundTripped.cookies.map(cookie =>
      cookie.source ? cookie : { ...cookie, source: originalCookieIds.has(cookie.id) ? 'response' as const : 'manual' as const },
    );
    await services.cookieJar.update(cookieJar, { cookies: relabeled });

    const persisted = await services.cookieJar.getOrCreateForParentId(workspace._id);
    const persistedCookie = persisted.cookies.find(c => c.key === 'poc');
    expect(persistedCookie?.source).toBe('response'); // <-- still untrusted

    // render.ts must still treat it as untrusted and never hand it to the Nunjucks renderer.
    const request = Object.assign(models.request.init(), {
      _id: 'req_after_script',
      parentId: workspace._id,
      url: 'http://localhost',
    });
    const renderedRequest = await getRenderedRequest({ request });
    const renderedCookie = renderedRequest.cookieJar.cookies.find(c => c.key === 'poc');
    expect(renderedCookie?.value).toBe(payload);
  });

  it('still templates a manually-authored cookie after passing through the scripting bridge', async () => {
    const templateValue = "{% uuid 'v4' %}";
    const workspace = await services.workspace.create();
    const initialJar = await services.cookieJar.getOrCreateForParentId(workspace._id);
    await services.cookieJar.update(initialJar, {
      cookies: [
        {
          id: 'c3',
          key: 'session',
          value: templateValue,
          domain: 'localhost',
          path: '/',
          secure: false,
          httpOnly: false,
          source: 'manual',
        },
      ],
    });
    const cookieJar = await services.cookieJar.getOrCreateForParentId(workspace._id);

    // Same bridge round-trip a real pre-request/after-response script run puts the jar
    // through, whether or not the script touches cookies.
    const bridged = new CookieObject(cookieJar).jar().toInsomniaCookieJar();
    const roundTripped = mergeCookieJar(cookieJar, bridged);

    const bridgedCookie = roundTripped.cookies.find(c => c.key === 'session');
    expect(bridgedCookie?.source).toBe('manual'); // <-- tag survives, same as the response case above

    await services.cookieJar.update(cookieJar, { cookies: roundTripped.cookies });

    const request = Object.assign(models.request.init(), {
      _id: 'req_manual_after_script',
      parentId: workspace._id,
      url: 'http://localhost',
    });
    const renderedRequest = await getRenderedRequest({ request });
    const renderedCookie = renderedRequest.cookieJar.cookies.find(c => c.key === 'session');

    // still rendered as a live template, exactly like the pre-fix behavior for manual cookies
    expect(renderedCookie?.value).not.toBe(templateValue);
    expect(renderedCookie?.value).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// Cookies persisted before the `source` field existed have no such field on disk at all --
// not 'response', not 'manual', just absent. cookie-jar.ts's init-model migration (run on every
// DB read, before a doc reaches render.ts or the scripting bridge) grandfathers these in as
// 'manual' so a user's pre-existing templated cookie keeps working after upgrading. This checks
// that grandfathering actually happens, and that it survives a script run (rather than the
// scripting bridge's round-trip somehow re-losing the tag and hitting the fail-closed fallback
// added to network.ts, which would silently break templating for upgrading users).
describe('legacy cookie jar predating the source field', () => {
  const insertLegacyCookieJar = async (workspaceId: string, cookies: Record<string, unknown>[]) => {
    const parentId = workspaceId;
    const _id = `jar_${crypto.createHash('sha1').update(parentId).digest('hex')}`;
    await database.insert({
      _id,
      type: 'CookieJar',
      parentId,
      name: 'Default Jar',
      cookies,
      created: Date.now(),
      modified: Date.now(),
    });
  };

  it('migrates an undefined source to manual on read, before any script runs', async () => {
    const workspace = await services.workspace.create();
    await insertLegacyCookieJar(workspace._id, [
      {
        id: 'legacy1',
        key: 'session',
        value: "{% uuid 'v4' %}",
        domain: 'localhost',
        path: '/',
        secure: false,
        httpOnly: false,
        // no `source` field at all -- this is what pre-#10475 data looks like on disk
      },
    ]);

    const cookieJar = await services.cookieJar.getOrCreateForParentId(workspace._id);
    const cookie = cookieJar.cookies.find(c => c.key === 'session');
    expect(cookie?.source).toBe('manual');
  });

  it('keeps templating a migrated legacy cookie across a script run', async () => {
    const templateValue = "{% uuid 'v4' %}";
    const workspace = await services.workspace.create();
    await insertLegacyCookieJar(workspace._id, [
      {
        id: 'legacy2',
        key: 'session',
        value: templateValue,
        domain: 'localhost',
        path: '/',
        secure: false,
        httpOnly: false,
      },
    ]);

    // The read migration must run before the cookie ever reaches the scripting bridge.
    const cookieJar = await services.cookieJar.getOrCreateForParentId(workspace._id);
    expect(cookieJar.cookies.find(c => c.key === 'session')?.source).toBe('manual');

    const bridged = new CookieObject(cookieJar).jar().toInsomniaCookieJar();
    const roundTripped = mergeCookieJar(cookieJar, bridged);
    expect(roundTripped.cookies.find(c => c.key === 'session')?.source).toBe('manual');

    await services.cookieJar.update(cookieJar, { cookies: roundTripped.cookies });

    const request = Object.assign(models.request.init(), {
      _id: 'req_legacy_after_script',
      parentId: workspace._id,
      url: 'http://localhost',
    });
    const renderedRequest = await getRenderedRequest({ request });
    const renderedCookie = renderedRequest.cookieJar.cookies.find(c => c.key === 'session');

    expect(renderedCookie?.value).not.toBe(templateValue);
    expect(renderedCookie?.value).toMatch(/^[0-9a-f-]{36}$/);
  });
});
