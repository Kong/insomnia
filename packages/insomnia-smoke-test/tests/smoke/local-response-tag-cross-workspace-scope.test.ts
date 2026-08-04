import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

// The built-in `response` template tag (local-template-tags.ts) resolves its `id` argument — an
// author-supplied string typed directly into a request body, not derived from render context — by
// bare `_id` lookup with only an existence check. It never verified the resolved request's ancestor
// chain matches the workspace currently being rendered, so any request in any workspace/project could
// read the latest response body/header/url of any request anywhere in the local database just by
// knowing its `req_...` id (CROSS-TENANT-DB-ACCESS-FINDINGS.md Finding 2, closed by
// SEC-SERVICES-FIXES-AUDIT-PLAN.md Item 3). No plugin and no sandbox toggle are involved — this is a
// built-in tag reachable by anyone who can type it into a request body, including via an
// imported/shared collection from an untrusted source.
//
// Import assigns each request a fresh id, so the probe's tag can't reference the victim's id as a
// literal in a static fixture — that literal would be stale before the app even starts. Instead the
// victim's real, post-import id is read back via the same database bridge the real app UI is backed
// by (window.database.invoke, read-only here), and typed into the probe request's real body editor —
// the same effect as a user pasting a real `req_...` id they learned some other way. Both the setup
// and the read happen through the real UI: the request body editor and the tag's Live Preview.

const VICTIM_MARKER = 'VICTIM-CONTENT-MARKER-b39a71';
const BODY_CODE_MIRROR = '[data-testid="request-pane"] [data-testid="CodeEditor"] .CodeMirror';

test('the response tag refuses to read a request/response that belongs to a different workspace', async ({
  page,
  insomnia,
}) => {
  // Two separate collections imported from two separate files, so the probe's reference to the
  // victim's request id is a genuine cross-workspace reference, not two requests that happen to
  // share an import batch (import remaps in-batch id references, which would mask this bug).
  await insomnia.projectPage.importMultipleFixtures([
    'local-response-tag-cross-workspace-scope-victim.yaml',
    'local-response-tag-cross-workspace-scope-probe.yaml',
  ]);

  // Persist a real response for the "victim" request, which lives in a different workspace than the
  // probe request below.
  await insomnia.projectPage.workspaceList.openWorkspace('Victim Collection');
  await insomnia.navigationSidebar.clickRequestOrFolder('victim');
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(page.getByRole('button', { name: 'Cancel Request' })).toBeHidden({ timeout: 30_000 });

  const victimRequestId: string = await page.evaluate(async () => {
    const requests = await (window as any).database.invoke('find', 'Request', {});
    const victim = requests.find((r: any) => r.name === 'victim');
    if (!victim) {
      throw new Error('victim request not found after import');
    }
    return victim._id;
  });

  // Switch to the unrelated "Probe Collection" workspace and open its only request.
  await insomnia.projectPage.navigateFromWorkspaceBreadcrumb();
  await insomnia.projectPage.workspaceList.openWorkspace('Probe Collection');
  await insomnia.navigationSidebar.clickRequestOrFolder('Sandbox Probe');
  await page.getByText('Body', { exact: true }).click();

  // Replace the placeholder body with a real `{% response %}` tag referencing the victim's real,
  // post-import id — through the real body editor, the same as a user pasting a learned id.
  await expect.soft(page.locator(BODY_CODE_MIRROR)).toContainText('PLACEHOLDER_TAG_TEXT');
  await page.evaluate(
    ({ sel, id }) => {
      const node = document.querySelector(sel) as any;
      node?.CodeMirror?.setValue(`{% response 'body', '${id}', 'b64::JC5kYXRh::46b', 'never', 60 %}`);
    },
    { sel: BODY_CODE_MIRROR, id: victimRequestId },
  );
  await expect.soft(page.locator(BODY_CODE_MIRROR)).not.toContainText('PLACEHOLDER_TAG_TEXT');
  // Wait for the editor's debounced onChange (DEBOUNCE_MILLIS, common/constants.ts) to actually
  // persist the new body, so the app isn't left with in-flight autosave state at teardown time.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const requests = await (window as any).database.invoke('find', 'Request', {});
        return requests.find((r: any) => r.name === 'Sandbox Probe')?.body?.text;
      }),
    )
    .toContain('{% response');

  const readTagPreview = async (): Promise<string> => {
    await page.locator("[data-template^=\"{% response\"]").click();
    const modal = page.getByRole('dialog');
    const preview = modal.getByLabel('Live Preview');
    await expect.soft(preview).not.toHaveValue('rendering...');
    const value = (await preview.inputValue()).trim();
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect.soft(modal).toBeHidden();
    return value;
  };

  await expect.poll(readTagPreview, { timeout: 20_000 }).toContain(`Could not find request ${victimRequestId}`);
  const finalPreview = await readTagPreview();
  expect.soft(finalPreview).not.toContain(VICTIM_MARKER);
});
