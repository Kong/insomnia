import { describe, expect, it } from 'vitest';

import { models, services } from '~/insomnia-data';

import { migrate as migrateWorkspace } from './workspace';

describe('migrate()', () => {
  it('migrates client certificates properly', async () => {
    const workspace = await services.workspace.create({
      name: 'My Workspace',
      certificates: [
        {
          key: 'key',
          passphrase: 'mypass',
        },
        {
          disabled: true,
          cert: 'cert',
        },
      ],
    });
    const migratedWorkspace = await migrateWorkspace(workspace);
    const certs = await services.clientCertificate.findByParentId(workspace._id);

    // Delete modified and created so we can assert them
    for (const cert of certs) {
      expect(typeof cert.modified).toBe('number');
      expect(typeof cert.created).toBe('number');
      delete (cert as Partial<typeof cert>).modified;
      delete (cert as Partial<typeof cert>).created;
    }

    expect(certs.length).toBe(2);
    expect(certs.sort((c1, c2) => (c1._id > c2._id ? -1 : 1))).toEqual([
      {
        _id: 'crt_e3e96e5fdd6842298b66dee1f0940f3d',
        cert: 'cert',
        disabled: false,
        isPrivate: false,
        host: '',
        key: null,
        parentId: 'wrk_cc1dd2ca4275747aa88199e8efd42403',
        passphrase: null,
        pfx: null,
        type: 'ClientCertificate',
      },
      {
        _id: 'crt_dd2ccc1a2745477a881a9e8ef9d42403',
        cert: null,
        disabled: false,
        isPrivate: false,
        host: '',
        key: 'key',
        parentId: 'wrk_cc1dd2ca4275747aa88199e8efd42403',
        passphrase: 'mypass',
        pfx: null,
        type: 'ClientCertificate',
      },
    ]);
    expect(migratedWorkspace.certificates).toBeUndefined();
    // Make sure we don't create new certs if we migrate again
    await migrateWorkspace(migratedWorkspace);
    const certsAgain = await services.clientCertificate.findByParentId(workspace._id);
    expect(certsAgain.length).toBe(2);
  });

  it('translates the scope correctly', async () => {
    const specW = await services.workspace.create({
      // @ts-expect-error
      scope: 'spec',
    });
    const debugW = await services.workspace.create({
      // @ts-expect-error
      scope: 'debug',
    });
    const nullW = await services.workspace.create({
      // @ts-expect-error
      scope: null,
    });
    const somethingElseW = await services.workspace.create({
      // @ts-expect-error
      scope: 'something',
    });
    const designW = await services.workspace.create({
      scope: models.workspace.WorkspaceScopeKeys.design,
    });
    const collectionW = await services.workspace.create({
      scope: models.workspace.WorkspaceScopeKeys.collection,
    });
    await migrateWorkspace(specW);
    await migrateWorkspace(debugW);
    await migrateWorkspace(nullW);
    await migrateWorkspace(somethingElseW);
    expect(specW.scope).toBe(models.workspace.WorkspaceScopeKeys.design);
    expect(debugW.scope).toBe(models.workspace.WorkspaceScopeKeys.collection);
    expect(nullW.scope).toBe(models.workspace.WorkspaceScopeKeys.collection);
    expect(somethingElseW.scope).toBe(models.workspace.WorkspaceScopeKeys.collection);
    expect(designW.scope).toBe(models.workspace.WorkspaceScopeKeys.design);
    expect(collectionW.scope).toBe(models.workspace.WorkspaceScopeKeys.collection);
  });
});
