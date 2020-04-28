import * as models from '../index';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('migrate()', () => {
  beforeEach(globalBeforeEach);

  it('populates apiSpec filename from parent workspace', async () => {
    const workspace = await models.workspace.create({
      name: 'My Workspace',
    });

    // Ensures an api-spec is pre-migration
    const apiSpec = models.apiSpec.init();
    apiSpec.parentId = workspace._id;
    expect(apiSpec.fileName).toBeFalsy();

    const migratedApiSpec = await models.apiSpec.migrate(apiSpec);

    expect(migratedApiSpec.fileName).toBe(workspace.name);
  });

  it('does not overwrite filename if it already exists', async () => {
    const workspace = await models.workspace.create({
      name: 'My Workspace',
    });

    // Ensures an api-spec is pre-migration
    const apiSpec = models.apiSpec.init();
    apiSpec.parentId = workspace._id;
    apiSpec.fileName = 'My ApiSpec';
    expect(apiSpec.fileName).toBeTruthy();

    const migratedApiSpec = await models.apiSpec.migrate(apiSpec);

    expect(migratedApiSpec.fileName).toBe(apiSpec.fileName);
  });
});
