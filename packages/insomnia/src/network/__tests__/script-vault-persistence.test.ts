import type { Environment } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateAES256Key } from '~/common/account/crypt';
import { base64encode } from '~/common/utils/vault';
import { fetchRequestData, tryToExecutePreRequestScript } from '~/network/network';
import { getRuntime } from '~/runtimes';

const { vaultEnvironmentPath } = models.environment;

const SECRETS = { token: 'super-secret-token', password: 'super-secret-password' };

// a script that never touches insomnia.vault still has to leave the stored secrets alone
const NO_OP_SCRIPT = 'const unused = 1;';

let originalNetworkRuntime: ReturnType<typeof getRuntime>['network'];
let capturedVault: Record<string, string> | undefined;

/** Stands in for the script sandbox: hands every piece of the context straight back, like a no-op script. */
const installEchoScriptRuntime = () => {
  const runtime = getRuntime();
  originalNetworkRuntime = runtime.network;
  (runtime as { network: unknown }).network = {
    ...runtime.network,
    runScript: async ({ context }: { context: Record<string, any> }) => {
      capturedVault = context.vault;
      return { ...context, logs: [] };
    },
  };
};

const setUpRequestWithVaultSecrets = async (symmetricKey: JsonWebKey) => {
  const project = await services.project.create({ name: 'project', remoteId: null });
  const workspace = await services.workspace.create({
    name: 'collection',
    parentId: project._id,
    scope: models.workspace.WorkspaceScopeKeys.collection,
  });
  await services.environment.getOrCreateForParentId(workspace._id);
  const request = await services.request.create({
    name: 'request',
    parentId: workspace._id,
    preRequestScript: NO_OP_SCRIPT,
  });

  // global environments live in their own workspace, a base global environment is the common case
  // because `globals` and `baseGlobals` then point at the very same document
  const globalWorkspace = await services.workspace.create({
    name: 'globals',
    parentId: project._id,
    scope: models.workspace.WorkspaceScopeKeys.environment,
  });
  const vaultCiphertext: Record<string, string> = {};
  for (const [key, plainValue] of Object.entries(SECRETS)) {
    vaultCiphertext[key] = await getRuntime().crypto.encryptSecretValue(plainValue, symmetricKey);
  }
  const globalBaseEnvironment = await services.environment.getOrCreateForParentId(globalWorkspace._id);
  await services.environment.update(globalBaseEnvironment, {
    isPrivate: true,
    data: { plain_global: 'visible', [vaultEnvironmentPath]: { ...vaultCiphertext } },
  });

  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);
  await services.workspaceMeta.update(workspaceMeta, {
    activeGlobalEnvironmentId: globalBaseEnvironment._id,
  });

  return { request, globalBaseEnvironmentId: globalBaseEnvironment._id, vaultCiphertext };
};

const runPreRequestScript = async (requestId: string) => {
  const requestData = await fetchRequestData(requestId);
  const transientVariables = { name: 'transientVariables', data: {}, dataPropertyOrder: null } as Environment;
  return tryToExecutePreRequestScript(requestData, transientVariables);
};

describe('vault secrets across a pre-request script run', () => {
  beforeEach(async () => {
    capturedVault = undefined;
    installEchoScriptRuntime();
  });

  afterEach(() => {
    (getRuntime() as { network: unknown }).network = originalNetworkRuntime;
  });

  it('keeps the stored ciphertext intact while handing the script decrypted values', async () => {
    const symmetricKey = await generateAES256Key();
    await services.userSession.update({ vaultKey: base64encode(symmetricKey), vaultSalt: 'salt' });
    await services.settings.patch({ enableVaultInScripts: true });
    const { request, globalBaseEnvironmentId, vaultCiphertext } = await setUpRequestWithVaultSecrets(symmetricKey);

    const result = await runPreRequestScript(request._id);
    expect(result).not.toHaveProperty('error');

    // the script must still see the real values
    expect(capturedVault).toEqual(SECRETS);

    // regression: the script run persisted the decrypted values over the stored ciphertext (INS-3909)
    const storedEnvironment = await services.environment.getById(globalBaseEnvironmentId);
    expect(storedEnvironment?.data[vaultEnvironmentPath]).toEqual(vaultCiphertext);
    expect(storedEnvironment?.data['plain_global']).toBe('visible');
  });

  it('keeps the stored ciphertext intact when the vault key is unavailable', async () => {
    const symmetricKey = await generateAES256Key();
    await services.userSession.update({ vaultKey: '', vaultSalt: 'salt' });
    await services.settings.patch({ enableVaultInScripts: true });
    const { request, globalBaseEnvironmentId, vaultCiphertext } = await setUpRequestWithVaultSecrets(symmetricKey);

    const result = await runPreRequestScript(request._id);
    expect(result).not.toHaveProperty('error');

    // no key means the script gets nothing, but the stored secrets must not be wiped
    expect(capturedVault).toEqual({});
    const storedEnvironment = await services.environment.getById(globalBaseEnvironmentId);
    expect(storedEnvironment?.data[vaultEnvironmentPath]).toEqual(vaultCiphertext);
  });

  it('keeps the stored ciphertext intact when vault access in scripts is disabled', async () => {
    const symmetricKey = await generateAES256Key();
    await services.userSession.update({ vaultKey: base64encode(symmetricKey), vaultSalt: 'salt' });
    await services.settings.patch({ enableVaultInScripts: false });
    const { request, globalBaseEnvironmentId, vaultCiphertext } = await setUpRequestWithVaultSecrets(symmetricKey);

    const result = await runPreRequestScript(request._id);
    expect(result).not.toHaveProperty('error');

    expect(capturedVault).toBeUndefined();
    const storedEnvironment = await services.environment.getById(globalBaseEnvironmentId);
    expect(storedEnvironment?.data[vaultEnvironmentPath]).toEqual(vaultCiphertext);
  });
});
