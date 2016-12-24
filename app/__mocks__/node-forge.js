/*
 * This is a stupid little mock that basically disabled encryption.
 * The reason it is needed is because the Forge module loader doesn't
 * play along with Jest.
 */

module.exports = function (options) {
  const forge = require('../../node_modules/node-forge/js/forge')(options);

  forge.util = {
    hexToBytes: forge.hexToBytes,
    bytesToHex: forge.bytesToHex,
    createBuffer (text) {
      return new Buffer(text);
    }
  };

  forge.pkcs5 = {
    pbkdf2 () {

    }
  };

  forge.md = {
    sha256: {
      create () {
        return 'TODO'
      }
    }
  };

  forge.random = {
    getBytesSync(n) {
      let s = '';
      for (let i = 0; i < n; i++) {
        s += 'a';
      }
      return s;
    }
  };

  forge.cipher = {
    createCipher(alg, key) {
      return {
        start(config) {
          this._config = config;
        },
        update(buffer) {
          this._data = buffer;
        },
        finish() {
          this.mode = {tag: 'tag'};
          this.output = this._data;
        }
      };
    },
    createDecipher(alg, key) {
      return {
        start (config) {
          this._config = config;
        },
        update (buffer) {
          this.output = buffer;
        },
        finish () {
          return true;
        }
      };
    }
  };

  return forge;
};
