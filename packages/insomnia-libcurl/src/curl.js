const nodeLibcurl = require('insomnia-node-libcurl');

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

    // Throw on deprecated options
    const disabledOpts = {
      [nodeLibcurl.Curl.option.URL]: this.setUrl,
    };
    if (disabledOpts[option]) {
      const name = Curl.optName(option);
      const newName = disabledOpts[option].name;
      throw new Error(`setOpt(${name}) is deprecated. Please use ${newName}() instead`);
    }

    this._handle.setOpt(option, value);
  }

  setUrl(url) {
    this._handle.setOpt(Curl.option.URL, url);
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

Curl.feature = nodeLibcurl.Curl.feature;
Curl.option = nodeLibcurl.Curl.option;
Curl.auth = nodeLibcurl.Curl.auth;
Curl.code = nodeLibcurl.Curl.code;
Curl.netrc = nodeLibcurl.Curl.netrc;
Curl.info = nodeLibcurl.Curl.info;

module.exports = Curl;
