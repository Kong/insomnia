import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../__jest__/before-each';
import * as models from '../index';
import { WorkspaceScopeKeys } from '../workspace';

describe('migrate()', () => {
  beforeEach(globalBeforeEach);

  it('migrates client certificates properly', async () => {
    const workspace = await models.workspace.create({
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
    const migratedWorkspace = await models.workspace.migrate(workspace);
    const certs = await models.clientCertificate.findByParentId(workspace._id);

    // Delete modified and created so we can assert them
    for (const cert of certs) {
      expect(typeof cert.modified).toBe('number');
      expect(typeof cert.created).toBe('number');
      // @ts-expect-error delete in order to test
      delete cert.modified;
      // @ts-expect-error delete in order to test
      delete cert.created;
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
    await models.workspace.migrate(migratedWorkspace);
    const certsAgain = await models.clientCertificate.findByParentId(workspace._id);
    expect(certsAgain.length).toBe(2);
  });

  it('translates the scope correctly', async () => {
    const specW = await models.workspace.create({
      // @ts-expect-error intentionally incorrect - old scope type
      scope: 'spec',
    });
    const debugW = await models.workspace.create({
      // @ts-expect-error intentionally incorrect - old scope type
      scope: 'debug',
    });
    const nullW = await models.workspace.create({
      // @ts-expect-error intentionally incorrect - old scope type
      scope: null,
    });
    const somethingElseW = await models.workspace.create({
      // @ts-expect-error intentionally incorrect - old scope type
      scope: 'something',
    });
    const designW = await models.workspace.create({
      scope: WorkspaceScopeKeys.design,
    });
    const collectionW = await models.workspace.create({
      scope: WorkspaceScopeKeys.collection,
    });
    await models.workspace.migrate(specW);
    await models.workspace.migrate(debugW);
    await models.workspace.migrate(nullW);
    await models.workspace.migrate(somethingElseW);
    expect(specW.scope).toBe(WorkspaceScopeKeys.design);
    expect(debugW.scope).toBe(WorkspaceScopeKeys.collection);
    expect(nullW.scope).toBe(WorkspaceScopeKeys.collection);
    expect(somethingElseW.scope).toBe(WorkspaceScopeKeys.collection);
    expect(designW.scope).toBe(WorkspaceScopeKeys.design);
    expect(collectionW.scope).toBe(WorkspaceScopeKeys.collection);
  });
});
