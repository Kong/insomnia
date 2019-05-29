const nodeLibcurl = require('node-libcurl');

class Curl {
  constructor() {
    this._handle = null;
    this._options = [];
    this._features = [];
    this._handle = new nodeLibcurl.Curl();
  }

  setOpt(option, value) {
    if (!Object.keys(Curl.option).find(k => Curl.option[k])) {
      throw new Error(`Cannot setOpt for unknown option ${option}`);
    }

    this._handle.setOpt(option, value);
  }

  static getVersion() {
    return nodeLibcurl.Curl.getVersion();
  }

  static optName(opt) {
    const name = Object.keys(Curl.option).find(name => Curl.option[name] === opt);
    return name || opt;
  }

  getInfo(property) {
    if (!Object.keys(Curl.info).find(k => Curl.info[k])) {
      throw new Error(`Cannot getInfo for unknown option ${property}`);
    }

    return this._handle.getInfo(property);
  }

  enable(feature) {
    if (!Object.keys(Curl.feature).find(k => Curl.feature[k])) {
      throw new Error(`Cannot enable unknown feature ${feature}`);
    }

    this._handle.enable(feature);
  }

  perform() {
    this._handle.perform();
  }

  close() {
    if (this._handle) {
      try {
        this._handle.close();
      } catch (err) {
        // Handle probably closed already
      }
    }
  }

  cancel() {
    // TODO
    this.close();
  }

  on(name, fn) {
    this._handle.on(name, fn);
  }
}

Curl.feature = nodeLibcurl.CurlFeature;
Curl.option = nodeLibcurl.Curl.option;
Curl.auth = nodeLibcurl.CurlAuth;
Curl.code = nodeLibcurl.CurlCode;
Curl.netrc = nodeLibcurl.CurlNetrc;
Curl.info = nodeLibcurl.Curl.info;
Curl.info.debug = nodeLibcurl.CurlInfoDebug;

module.exports = Curl;
