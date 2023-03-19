import forge from 'node-forge';

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
    getBytesSync(num: number) {
      let s = '';

      for (let i = 0; i < num; i++) {
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
        _config: {} as any,
        _data: {} as any,
        mode: {} as any,
        output: {} as any,
        start(config: any) {
          this._config = config;
        },

        update(buffer: any) {
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
        _config: {} as any,
        output: {} as any,
        start(config: any) {
          this._config = config;
        },

        update(buffer: any) {
          this.output = buffer;
        },

        finish() {
          return true;
        },
      };
    },
  },
};
