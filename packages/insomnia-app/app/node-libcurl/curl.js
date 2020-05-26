import {
  Curl as _Curl,
  CurlAuth,
  CurlCode,
  CurlInfoDebug,
  CurlFeature,
  CurlNetrc,
} from 'node-libcurl';

export class Curl {
  constructor() {
    this._options = [];
    this._features = [];
    this._handle = new _Curl();
  }

  setOpt(option, value) {
    if (!Object.keys(Curl.option).find(k => Curl.option[k])) {
      throw new Error(`Cannot setOpt for unknown option ${option}`);
    }

    // Throw on deprecated options
    this._handle.setOpt(option, value);
  }

  static getVersion() {
    return _Curl.getVersion();
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

Curl.option = _Curl.option;
Curl.info = _Curl.info;

// These were removed from node-libcurl >= v2
Curl.auth = CurlAuth;
Curl.code = CurlCode;
Curl.feature = CurlFeature;
Curl.info.debug = CurlInfoDebug;
Curl.netrc = CurlNetrc;
