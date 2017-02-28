import requestLib from 'request';
import NetworkResponseConfig from '../lib/response-config';
import BaseNetworkBackend from './base';

const DEFAULT_REQUEST_OPTIONS = {
  // Setup redirect rules
  followAllRedirects: true,
  followRedirect: true,
  maxRedirects: 50, // Arbitrary (large) number
  timeout: 0,

  // Unzip gzipped responses
  gzip: true,

  // Time the request
  time: true,

  // SSL Checking
  rejectUnauthorized: true,

  // Proxy
  proxy: null,

  // Use keep-alive by default
  forever: true,

  // Force request to return response body as a Buffer instead of string
  encoding: null,
};

const FAMILY_FALLBACKS = [
  null, // Use the request library default lookup
  6, // IPv6
  4, // IPv4
];

export default class RequestLibNetworkBackend extends BaseNetworkBackend {
  constructor (networkRequestConfig) {
    super(networkRequestConfig);

    this._networkRequestConfig = networkRequestConfig;
    this._cancelCallback = null;
  }

  send () {
    return new Promise((resolve, reject) => {
      let config;

      try {
        config = this._buildConfig();
      } catch (err) {
        return reject(err);
      }

      // Initialize the response object
      const networkResponseConfig = new NetworkResponseConfig()
        .setStartTime(Date.now())
        .setUrl(this._networkRequestConfig.url);

      // Define callback to listen for response
      config.callback = (err, res) => {
        if (err) {
          networkResponseConfig
            .setStatusMessage('ERROR')
            .setError(err.message);
        } else {
          networkResponseConfig
            .setStatusCode(res.statusCode)
            .setStatusMessage(res.statusMessage)
            .setContentType(res.headers['content-type'] || null)
            .setBody(res.body.toString('base64'), 'base64', res.body.length);

          // Loop over response headers and set them
          for (const name of Object.keys(res.headers)) {
            for (const value of res.headers[name]) {
              networkResponseConfig.setHeader(name, value);
            }
          }

          // Loop over cookies and set them (if we have any set-cookie headers)
          if (networkResponseConfig.getHeaders('set-cookie').length) {
            console.log('TODO: COOKIES');
          }

          for (const name of Object.keys(res.headers)) {
            for (const value of res.headers[name]) {
              networkResponseConfig.setHeader(name, value);
            }
          }
        }

        // Set all properties that are success/failure agnostic
        networkResponseConfig
          .setEndTime(Date.now());

        // Return the response object
        resolve(networkResponseConfig);

        // Disable the cancel callback now that we're done
        this._cancelCallback = null;
      };

      // Actually trigger the request
      const req = new requestLib.Request(config);

      // Setup a cancel callback for us
      this._cancelCallback = () => {
        req.abort();

        networkResponseConfig
          .setEndTime(Date.now())
          .setStatusCode(0)
          .setStatusMessage('CANCELLED');

        resolve(networkResponseConfig);
      }
    })
  }

  cancel () {
    if (typeof this._cancelCallback === 'function') {
      this._cancelCallback();
    }
  }

  _buildConfig () {
    return Object.assign({}, DEFAULT_REQUEST_OPTIONS, {
      method: this._networkRequestConfig.method,
      url: this._networkRequestConfig.url,
      body: this._networkRequestConfig.body,
      headers: this._buildConfigHeaders(),
    });
  }

  _buildConfigHeaders () {
    const headers = {};

    for (const {name, value} of this._networkRequestConfig.headers) {
      headers[name] = value;
    }

    return headers;
  }
}
