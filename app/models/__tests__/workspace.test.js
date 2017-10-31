import * as models from '../index';
import {globalBeforeEach} from '../../__jest__/before-each';

describe('migrate()', () => {
  beforeEach(globalBeforeEach);
  it('migrates client certificates properly', async () => {
    const workspace = await models.workspace.create({
      name: 'My Workspace',
      certificates: [
        {key: 'key', passphrase: 'mypass'},
        {disabled: true, cert: 'cert'}
      ]
    });

    const migratedWorkspace = await models.workspace.migrate(workspace);
    const certs = await models.clientCertificate.findByParentId(workspace._id);

    // Delete modified and created so we can assert them
    for (const cert of certs) {
      expect(typeof cert.modified).toBe('number');
      expect(typeof cert.created).toBe('number');
      delete cert.modified;
      delete cert.created;
    }

    expect(certs.length).toBe(2);
    expect(certs.sort((c1, c2) => c1._id > c2._id ? -1 : 1)).toEqual([{
      _id: 'crt_a262d22b5fa8491c9bd958fba03e301e',
      cert: null,
      disabled: false,
      isPrivate: false,
      key: 'key',
      parentId: 'wrk_cc1dd2ca4275747aa88199e8efd42403',
      passphrase: 'mypass',
      pfx: null,
      type: 'ClientCertificate'
    }, {
      _id: 'crt_2e7c268809ee44b8900d5cbbaa7d3a19',
      cert: 'cert',
      disabled: false,
      isPrivate: false,
      key: null,
      parentId: 'wrk_cc1dd2ca4275747aa88199e8efd42403',
      passphrase: null,
      pfx: null,
      type: 'ClientCertificate'
    }]);

    expect(migratedWorkspace.certificates).toBeUndefined();

    // Make sure we don't create new certs if we migrate again
    await models.workspace.migrate(migratedWorkspace);
    const certsAgain = await models.clientCertificate.findByParentId(workspace._id);
    expect(certsAgain.length).toBe(2);
  });
});
