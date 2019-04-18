import * as crypt from '../crypt';

describe('crypt', () => {
  describe('deriveKey()', () => {
    it('derives a key properly', async () => {
      const result = await crypt.deriveKey('Password', 'email', 'salt');
      const expected = 'fb058595c02ae9660ed7098273bf50e49407942ecc437bf317638d76c4578eae';

      expect(result).toBe(expected);
    });
  });

  describe('AES', () => {
    it('encrypts and decrypts', () => {
      const key = {
        kty: 'oct',
        alg: 'A256GCM',
        ext: true,
        key_ops: ['encrypt', 'decrypt'],
        k: '5hs1f2xuiNPHUp11i6SWlsqYpWe_hWPcEKucZlwBfFE',
      };

      const resultEncrypted = crypt.encryptAES(key, 'Hello World!', 'additional data');
      const resultDecrypted = crypt.decryptAES(key, resultEncrypted);

      expect(resultDecrypted).toEqual('Hello World!');
    });
  });

  describe('AES Buffer', () => {
    it('encrypts and decrypts', () => {
      const key = {
        kty: 'oct',
        alg: 'A256GCM',
        ext: true,
        key_ops: ['encrypt', 'decrypt'],
        k: '5hs1f2xuiNPHUp11i6SWlsqYpWe_hWPcEKucZlwBfFE',
      };

      const resultEncrypted = crypt.encryptAESBuffer(key, Buffer.from('Hello World!', 'utf8'));
      const resultDecrypted = crypt.decryptAESToBuffer(key, resultEncrypted);

      expect(resultDecrypted).toEqual(Buffer.from('Hello World!', 'utf8'));
    });
  });

  describe('RSA', () => {
    it('encrypts and decrypts', () => {
      const privateKey = {
        alg: 'RSA-OAEP-256',
        kty: 'RSA',
        key_ops: ['decrypt'],
        ext: true,
        d:
          'UkouuQID2o9Q6VyiRMmK8ETPsAHWEL2HMYwy34c4nTpM7KfqlNeMzs6HmbuEfx-bwUvTqOO4Tz7FZw4ILD6s5sE9' +
          'xqIxmV-fIiqiBI4aWKozxgf9OJZWKqru3loSd923O3fI3oa9ZCTaKc1U0bYOB-XP2Q_hB2M64Hb63-McXAM0RQwN' +
          'R5vh_TweqcaBiXAyhuYl2NarOwrbSlSttkhZzy4i-otulPGkW61I5rNflsSmnYEijmD7zl9EouEOYcHlJGmNLHjG' +
          'nHlb-avvwvER5NZVDwd6vT61QR1wwpnYSjVH_Z_OrqJu8U2J64J_MaZPJog3KbPYqZnGcxJ9ldnSYQ',
        dp:
          'SnO3kTAogveLWkqSuDVxQLOo4QXEq-Us_lM00dfGIuZrfWnyqOd6_NJKu-G62PCQgUMBy7r_f3N3sOseRVl_5fy3' +
          'kd21n7WmnQcMGBm-VRathT0nOz-fhzbwCJwtuI1g36YtaCQEQiC4pYxMYmXaX1WGPhL4rGSNz5SMHrPvyTU',
        dq:
          'eaK2-w2Jb7rWWYhLon-RKlzWXTPHjnt1JfLkD_D12FNE6KAcbyIETDid8_sXnqj3oCr3HrO-AuNI87zZJ4UVsy2J' +
          'mvNNVFTn0s8R6TZ9_o9LCXBdBcRST5qpAax0t-duHRaKMuWPG3xAb2Uub6T42C7yd-mpOIRo7uSHFGQGzWk',
        e: 'AQAB',
        n:
          '5wOecCVWaDB2s-ybsCp1BskBW5fj3iH4xja5hNTfW_s-ERgbEoBA_PSF60PC1se4r_oWwFBfIRL9OUTYwYOuQOuC' +
          'rgd7ODa_YBeOjzHUA1b0K5kWXaqPxkmN8kJPISyLdLjCCOwHtTFnqxL9JjnU4aIxy4OU1S5KR6v-XVeLOZtUOm4k' +
          'AhLVfmdzYB1nZmq9xH1O8_acIUoWDbAWX6fIXhPhn7jCuCO4WZQVDxZ5_bc27UVhR4VYe2Our7aESUQ5ZyMtYNym' +
          'o9Oy0y_m3OS6W_JR_feXBbxRCBuGf7fjnvV9ohx1ZqLpJFx9_xL7naoVCQhBDfVE31iYz3L6KTIhFQ',
        p:
          '_Pyx-puBM_BQubDg8BZsrssgmECHuieKEwlR19fckczS4dlgQVUemUTr-RqmItj7k-WMG7mWuRgbIrGO1sigpuDy' +
          'uKWkg3KyqoeIvgsaJV05xu8pneVblTXJSCtNMXvYMa6mPNYudUSy8-TlLyLg_w5lUnuA8Mq8xehzCsPrM-0',
        q:
          '6cPuxuW0zaMIVAJpOcLf5D0dA-mLXxmmJoMDodamM7t7_oGYgFR3Os9gtB5TYxsUjjRCWGkDy7ru8arcbTNCnNFd' +
          'PAayzTdWCW-GBs3xswggjmugGupjOnrtD-N1_fG040Ka8UqwMyI1lUapxaKhViR9TNYUz6EAOjxycf8MTMk',
        qi:
          'FMVx12_ioueu052xgFxWdIS_lImUGTrw8Iiw_kp-KKsONtofs91A5GVRtyg_wdXpG2qyomaet1hTlHhLnoI23L2a' +
          'EkQ87SokIpoR9lR8jfIRwLwKKXMc33_bRRQXvWop0yvTzmSGaC0gULcqj0OHiUR1u9Ver1ZvgGz2jh4mP_E',
      };

      const publicKey = {
        alg: 'RSA-OAEP-256',
        kty: 'RSA',
        key_ops: ['encrypt'],
        e: 'AQAB',
        n:
          '5wOecCVWaDB2s-ybsCp1BskBW5fj3iH4xja5hNTfW_s-ERgbEoBA_PSF60PC1se4r_oWwFBfIRL9OUTYwYOuQO' +
          'uCrgd7ODa_YBeOjzHUA1b0K5kWXaqPxkmN8kJPISyLdLjCCOwHtTFnqxL9JjnU4aIxy4OU1S5KR6v-XVeLOZtU' +
          'Om4kAhLVfmdzYB1nZmq9xH1O8_acIUoWDbAWX6fIXhPhn7jCuCO4WZQVDxZ5_bc27UVhR4VYe2Our7aESUQ5Zy' +
          'MtYNymo9Oy0y_m3OS6W_JR_feXBbxRCBuGf7fjnvV9ohx1ZqLpJFx9_xL7naoVCQhBDfVE31iYz3L6KTIhFQ',
      };

      const resultEncrypted = crypt.encryptRSAWithJWK(publicKey, 'aaaaaaaaa');
      const resultDecrypted = crypt.decryptRSAWithJWK(privateKey, resultEncrypted);

      const expectedDecrypted = 'aaaaaaaaa';

      expect(resultDecrypted.toString()).toEqual(expectedDecrypted);
    });
  });
});
