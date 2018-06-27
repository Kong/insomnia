import * as crypt from '../crypt';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('deriveKey()', () => {
  beforeEach(globalBeforeEach);
  it('derives a key properly', async () => {
    const result = await crypt.deriveKey('Password', 'email', 'salt');

    const expected = '';

    expect(result).toBe(expected);
  });
});

describe('encryptRSA', () => {
  beforeEach(globalBeforeEach);
  it('encrypts and decrypts', () => {
    const resultEncrypted = crypt.encryptAES(
      'rawkey',
      'Hello World!',
      'additional data'
    );
    const resultDecrypted = crypt.decryptAES('rawkey', resultEncrypted);

    const expectedEncrypted = {
      ad: '6164646974696f6e616c2064617461',
      d: '48656c6c6f253230576f726c6421',
      iv: '616161616161616161616161',
      t: '746167'
    };

    const expectedDecrypted = 'Hello World!';

    expect(resultEncrypted).toEqual(expectedEncrypted);
    expect(resultDecrypted).toEqual(expectedDecrypted);
  });
});
