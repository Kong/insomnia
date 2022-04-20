/*
 * This is a stupid little mock that basically disabled encryption.
 * The reason it is needed is because the Forge module loader doesn't
 * play along with Jest.
 */
import forge from '../../node_modules/node-forge/lib/index';

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = {
  jsbn: forge.jsbn,
  util: forge.util,
  pkcs5: {
    pbkdf2: forge.pkcs5.pbkdf2,
  },
  md: {
    sha256: forge.md.sha256,
  },
  rsa: {
    setPublicKey() {
      return {
        encrypt(str: string) {
          return str;
        },
      };
    },

    setPrivateKey() {
      return {
        decrypt(str: string) {
          return str;
        },
      };
    },
  },
  random: {
    getBytesSync(n: number) {
      let s = '';

      for (let i = 0; i < n; i++) {
        s += 'a';
      }

      return s;
    },
  },
  pki: {
    rsa: {
      generateKeyPair() {
        return {
          privateKey: {
            d: 'a',
            dP: 'a',
            dQ: 'a',
            e: 'a',
            n: 'a',
            p: 'a',
            q: 'a',
            qInv: 'a',
          },
          publicKey: {
            e: 'a',
            n: 'a',
          },
        };
      },
    },
  },
  cipher: {
    createCipher() {
      return {
        start(config) {
          this._config = config;
        },

        update(buffer) {
          this._data = buffer;
        },

        finish() {
          this.mode = {
            tag: 'tag',
          };
          this.output = this._data;
        },
      };
    },

    createDecipher() {
      return {
        start(config) {
          this._config = config;
        },

        update(buffer) {
          this.output = buffer;
        },

        finish() {
          return true;
        },
      };
    },
  },
};
