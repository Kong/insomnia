/*
 * This is a stupid little mock that basically disabled encryption.
 * The reason it is needed is because the Forge module loader doesn't
 * play along with Jest.
 */
const forge = require('../../node_modules/node-forge/lib/index');

module.exports = {
  jsbn: forge.jsbn,
  util: forge.util,
  pkcs5: {
    pbkdf2() {}
  },
  md: {
    sha256: {
      create() {
        return 'TODO';
      }
    }
  },
  rsa: {
    setPublicKey() {
      return {
        encrypt(str) {
          return str;
        }
      };
    },
    setPrivateKey() {
      return {
        decrypt(str) {
          return str;
        }
      };
    }
  },
  random: {
    getBytesSync(n) {
      let s = '';
      for (let i = 0; i < n; i++) {
        s += 'a';
      }
      return s;
    }
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
            qInv: 'a'
          },
          publicKey: {
            e: 'a',
            n: 'a'
          }
        };
      }
    }
  },
  cipher: {
    createCipher(alg, key) {
      return {
        start(config) {
          this._config = config;
        },
        update(buffer) {
          this._data = buffer;
        },
        finish() {
          this.mode = { tag: 'tag' };
          this.output = this._data;
        }
      };
    },
    createDecipher(alg, key) {
      return {
        start(config) {
          this._config = config;
        },
        update(buffer) {
          this.output = buffer;
        },
        finish() {
          return true;
        }
      };
    }
  }
};
