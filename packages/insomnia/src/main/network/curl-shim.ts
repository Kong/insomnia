import axios, { AxiosRequestConfig } from 'axios';
import { EventEmitter } from 'events';
import fs from 'fs';
import https from 'https';
import { performance } from 'perf_hooks';

export class CurlEnums {
  static info = {
    COOKIELIST: 'COOKIELIST',
    EFFECTIVE_URL: 'EFFECTIVE_URL',
    SIZE_DOWNLOAD: 'SIZE_DOWNLOAD',
    TOTAL_TIME: 'TOTAL_TIME',
  };

  static option = {
    ACCEPT_ENCODING: 'ACCEPT_ENCODING',
    CAINFO: 'CAINFO',
    CAINFO_BLOB: 'CAINFO_BLOB',
    COOKIE: 'COOKIE',
    COOKIEFILE: 'COOKIEFILE',
    COOKIELIST: 'COOKIELIST',
    CUSTOMREQUEST: 'CUSTOMREQUEST',
    DEBUGFUNCTION: 'DEBUGFUNCTION',
    FOLLOWLOCATION: 'FOLLOWLOCATION',
    HTTPAUTH: 'HTTPAUTH',
    HTTPGET: 'HTTPGET',
    HTTPHEADER: 'HTTPHEADER',
    HTTPPOST: 'HTTPPOST',
    HTTP_VERSION: 'HTTP_VERSION',
    INFILESIZE_LARGE: 'INFILESIZE_LARGE',
    KEYPASSWD: 'KEYPASSWD',
    MAXREDIRS: 'MAXREDIRS',
    NETRC: 'NETRC',
    NOBODY: 'NOBODY',
    NOPROGRESS: 'NOPROGRESS',
    NOPROXY: 'NOPROXY',
    PATH_AS_IS: 'PATH_AS_IS',
    PASSWORD: 'PASSWORD',
    POST: 'POST',
    POSTFIELDS: 'POSTFIELDS',
    PROXY: 'PROXY',
    PROXYAUTH: 'PROXYAUTH',
    READDATA: 'READDATA',
    READFUNCTION: 'READFUNCTION',
    SSLCERT: 'SSLCERT',
    SSLCERTTYPE: 'SSLCERTTYPE',
    SSLKEY: 'SSLKEY',
    SSL_VERIFYHOST: 'SSL_VERIFYHOST',
    SSL_VERIFYPEER: 'SSL_VERIFYPEER',
    TIMEOUT_MS: 'TIMEOUT_MS',
    UNIX_SOCKET_PATH: 'UNIX_SOCKET_PATH',
    UPLOAD: 'UPLOAD',
    URL: 'URL',
    USERAGENT: 'USERAGENT',
    USERNAME: 'USERNAME',
    VERBOSE: 'VERBOSE',
    WRITEFUNCTION: 'WRITEFUNCTION',
  };
}

export enum CurlAuth {
  Basic = 1 << 0,
  Digest = 1 << 1,
  Ntlm = 1 << 3,
  DigestIe = 1 << 4,
  Any = ~DigestIe,
}

export enum CurlCode {
  CURLE_ABORTED_BY_CALLBACK = 42
}

export enum CurlHttpVersion {
  None,
  V1_0,
  V1_1,
  V2_0,
  V2Tls,
  V2PriorKnowledge,
  v3,
}

export enum CurlInfoDebug {
  Text,
  HeaderIn,
  HeaderOut,
  DataIn,
  DataOut,
  SslDataIn,
  SslDataOut,
}
export enum CurlNetrc {
  Ignored,
  Optional,
  Required,
}
export enum CurlFeature {
  NoDataParsing = 1 << 0,
  NoHeaderParsing = 1 << 1,
  Raw = NoDataParsing | NoHeaderParsing,
}

class NotCurl extends EventEmitter {
  reqOptions: AxiosRequestConfig;
  writeListener: any;
  debugListener: any;
  // NOTE: these are for solving assignment ordering problems
  sslVerify: boolean;
  responseBodyBytes: number;
  elapsedTime: number;
  followRedirects: boolean;
  username: any;
  password: any;
  httpAuth: any;
  cookies: string[];
  caBundle: (string | Buffer)[];
  sslCertType: string;
  sslCert: any; // blob or filename
  sslKey: any; // blob or filename
  sslKeyPasswd: string;

  constructor() {
    super();
    this.reqOptions = { headers: {} };
    this.sslVerify = true;
    this.responseBodyBytes = 0;
    this.elapsedTime = 0;
    this.cookies = [];
    this.caBundle = [];
  }
  static option = CurlEnums.option;
  static info = CurlEnums.info;
  static getVersion() {
    return 'axios/0.21.1';
  }

  getInfo(opt) {
    const name = Object.keys(CurlEnums.info).find(name => CurlEnums.info[name] === opt);
    if (name === 'SIZE_DOWNLOAD') {
      return this.responseBodyBytes;
    }
    if (name === 'TOTAL_TIME') {
      return this.elapsedTime;
    }
    if (name === 'EFFECTIVE_URL') {
      return this.reqOptions.url;
    }

    console.log('unhandled getInfo', opt, name);
    return undefined;
  }
  setOpt(opt: any, val: any) {
    const name = Object.keys(CurlEnums.option).find(name => CurlEnums.option[name] === opt);

    switch (name) {
      case 'MAXREDIRS':
        this.reqOptions.maxRedirects = val;
        break;
      case 'FOLLOWLOCATION':
        this.followRedirects = val;
        break;
      case 'PROXY':
        // NOTE: explicitly ignore system env var HTTP/S_PROXY and NO_PROXY
        if (val === '') {
          this.reqOptions.proxy = false;
        } else {
          const { hostname, port } = new URL(val);
          this.reqOptions.proxy = {
            host: hostname,
            port: parseInt(port, 10),
          };
        }
        break;
      case 'HTTPAUTH':
        this.httpAuth = val;
        break;
      case 'USERNAME':
        this.username = val;
        break;
      case 'PASSWORD':
        this.password = val;
        break;
      case 'NOBODY':
        this.reqOptions.method = 'HEAD';
        break;
      case 'POST':
        this.reqOptions.method = 'POST';
        break;
      case 'CUSTOMREQUEST':
        this.reqOptions.method = val;
        break;
      case 'READDATA':
        this.reqOptions.data = fs.readFileSync(val, 'utf8');
        this.reqOptions.maxBodyLength = 100 * 1024 * 1024; // 100 MB or Infinity? what do we intend to support? :shrug:
        break;
      case 'TIMEOUT_MS':
        this.reqOptions.timeout = val;
        break;
      case 'SSL_VERIFYHOST':
        this.sslVerify = !!val;
        break;
      case 'SSL_VERIFYPEER':
        // NOTE: same as above in nodejs
        break;
      case 'CAINFO':
        // NOTE: needs testing
        this.caBundle.push(fs.readFileSync(val));
        break;
      case 'POSTFIELDS':
        this.reqOptions.data = val;
        break;
      case 'URL':
        this.reqOptions.url = val;
        break;
      case 'WRITEFUNCTION':
        this.writeListener = val;
        break;
      case 'DEBUGFUNCTION':
        this.debugListener = val;
        break;
      case 'HTTPHEADER':
        val.map(x => {
          const name = x.split(':')[0];
          // NOTE: skip empty header values
          if (x.split(':')[1]?.trim()) {
            this.reqOptions.headers[name] = x.split(':')[1]?.trim();
          }
        });
        break;
      case 'USERAGENT':
        this.reqOptions.headers['User-Agent'] = val;
        break;
      case 'COOKIELIST':
        // this.reqOptions.headers['Set-Cookie'] = val;
        console.log('cookielist', val);
        break;
      case 'COOKIEFILE':
        // do nothing
        break;
      case 'COOKIE':
        console.log('cookie', val);
        this.cookies.push(val);
        break;
      case 'SSLCERT':
        this.sslCert = val;
        break;
      case 'SSLKEY':
        this.sslKey = val;
        break;
      case 'SSLCERTTYPE':
        this.sslCertType = val;
        break;
      case 'KEYPASSWD':
        this.sslKeyPasswd = val;
        break;
      default:
        console.log('unhandled option', opt, name, val);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  enable(_) {
    // ignore this, as its only used for disabling auto parsing of headers and body
  }
  perform() {

    if (this.cookies.length) {
      this.reqOptions.headers['Cookie'] = this.cookies.join('; ');
    }
    // NOTE: disable follow redirects https://github.com/axios/axios/pull/307/files#diff-586c04c24
    if (!this.followRedirects) {
      this.reqOptions.maxRedirects = 0;
    }
    const agentConfig: https.AgentOptions = { rejectUnauthorized: this.sslVerify };
    if (!!this.caBundle.length) {
      agentConfig.ca = this.caBundle;
    }
    if (this.sslKey) {
      agentConfig.key = this.sslKey;
    }
    if (this.sslCert) {
      agentConfig.cert = this.sslCert;
    }
    if (this.sslKeyPasswd) {
      agentConfig.passphrase = this.sslKeyPasswd;
    }

    // TODO: digest, ntlm, netrc etc
    if (this.httpAuth === CurlAuth.Basic) {
      this.reqOptions.auth = { username: this.username, password: this.password };
    }
    this.reqOptions.httpsAgent = new https.Agent(agentConfig);
    this.reqOptions.adapter = require('axios/lib/adapters/http'),
    this.reqOptions.responseType = 'stream';
    this.reqOptions.validateStatus = () => true;
    const startTime = performance.now();
    axios.request(this.reqOptions)
      .then(({ data, status, statusText, headers, config, request }) => {
        console.log('perform', { data, status, statusText, headers, config, request });
        if (this.caBundle) {
          this.debugListener(CurlInfoDebug.Text, `Found bundle for host ${request.host} (#1)`);
        }

        this.debugListener(CurlInfoDebug.Text, `Connected to ${request.host} (#1)`);

        this.debugListener(CurlInfoDebug.HeaderOut, request._header);

        if (this.reqOptions.data !== undefined) {
          this.debugListener(CurlInfoDebug.DataOut, this.reqOptions.data);
        }
        // NOTE: axios chops HTTP/1.1 200 Success off the top of the raw header string
        this.debugListener(CurlInfoDebug.HeaderIn, `HTTP/${data.httpVersion} ${status} ${statusText}`);
        Object.entries(data.headers)
          .map(([name, value]) => `${name}: ${value}`)
          .map(h => this.debugListener(CurlInfoDebug.HeaderIn, h));

        data.on('data', (chunk: Buffer) => {
          this.responseBodyBytes += chunk.length;
          this.writeListener(chunk);
          this.debugListener(CurlInfoDebug.DataIn, chunk);
        });
        data.on('end', () => {
          this.elapsedTime = performance.now() - startTime;

          this.emit('end', null, null, [{
            version: 'HTTP/' + data.httpVersion,
            code: status,
            reason: statusText,
            headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
          }]);
          this.debugListener(CurlInfoDebug.Text, `Connection #1 to host ${request.host} left intact`);
        });
      }).catch(e => this.emit('error', e));
  }
  close() {
    // TODO: maybe reset state here?
    console.log('close');
    this.removeAllListeners('end');
    this.removeAllListeners('error');
  }
}

export { NotCurl as Curl };
