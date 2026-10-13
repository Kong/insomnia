import { models, services } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';

import { generateAES256Key } from '~/common/account/crypt';
import { base64encode } from '~/common/utils/vault';
import { getRuntime } from '~/runtimes';

import { maskOrDecryptVaultDataIfNecessary } from '../mask-or-decrypt-vault-data';

// the vault key is kept in the session encrypted by the OS secret storage, which is an identity
// transform in tests, so the session only needs to hold the base64 encoded symmetric key
const enableVault = async (symmetricKey: JsonWebKey) =>
  services.userSession.update({ vaultKey: base64encode(symmetricKey), vaultSalt: 'salt' });

describe('maskOrDecryptVaultDataIfNecessary', () => {
  beforeEach(async () => {
    await services.userSession.update({ vaultKey: '', vaultSalt: '' });
  });

  it('decrypts into a new object and leaves the stored ciphertext untouched', async () => {
    const symmetricKey = await generateAES256Key();
    await enableVault(symmetricKey);
    const storedVaultData = {
      token: await getRuntime().crypto.encryptSecretValue('secret-token', symmetricKey),
      password: await getRuntime().crypto.encryptSecretValue('secret-password', symmetricKey),
    };
    const ciphertext = { ...storedVaultData };

    const result = await maskOrDecryptVaultDataIfNecessary(storedVaultData, 'script');

    expect(result).toEqual({ token: 'secret-token', password: 'secret-password' });
    expect(result).not.toBe(storedVaultData);
    // regression: decrypting in place replaced the persisted ciphertext with plaintext (INS-3909)
    expect(storedVaultData).toEqual(ciphertext);
  });

  it('drops all values when the vault is enabled but no vault key is available, without mutating the input', async () => {
    await services.userSession.update({ vaultKey: '', vaultSalt: 'salt' });
    const storedVaultData = { token: 'cipher-1' };

    const result = await maskOrDecryptVaultDataIfNecessary(storedVaultData, 'script');

    expect(result).toEqual({});
    expect(storedVaultData).toEqual({ token: 'cipher-1' });
  });

  it('returns the data unchanged when the vault is not enabled', async () => {
    const storedVaultData = { token: 'cipher-1' };

    const result = await maskOrDecryptVaultDataIfNecessary(storedVaultData, 'script');

    expect(result).toEqual({ token: 'cipher-1' });
    expect(storedVaultData).toEqual({ token: 'cipher-1' });
  });

  it('masks into a new object and leaves the stored ciphertext untouched', async () => {
    const storedVaultData = { token: 'cipher-1' };

    const result = await maskOrDecryptVaultDataIfNecessary(storedVaultData, 'general');

    expect(result).toEqual({ token: models.environment.vaultEnvironmentMaskValue });
    expect(result).not.toBe(storedVaultData);
    expect(storedVaultData).toEqual({ token: 'cipher-1' });
  });

  it('returns non object values as is', async () => {
    expect(await maskOrDecryptVaultDataIfNecessary(undefined, 'script')).toBeUndefined();
    expect(await maskOrDecryptVaultDataIfNecessary(null, 'script')).toBeNull();
  });
});
