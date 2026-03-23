import { expect } from 'chai';
import type { ClientCertificate } from 'insomnia/src/models/client-certificate';
import type { RequestHeader } from 'insomnia/src/models/request';
import { filterClientCertificates } from 'insomnia/src/network/certificate';

import type { Settings } from '~/insomnia-data';

import { toPreRequestAuth } from './auth';
import { getExistingConsole } from './console';
import { CookieObject } from './cookies';
import { Environment, Variables, Vault } from './environments';
import { Execution } from './execution';
import { Folder, ParentFolders } from './folders';
import type { RequestContext } from './interfaces';
import { transformToSdkProxyOptions } from './proxy-configs';
import { Request as ScriptRequest, type RequestOptions, toScriptRequestBody } from './request';
import { RequestInfo } from './request-info';
import type { Response as ScriptResponse } from './response';
import { readBodyFromPath, toScriptResponse } from './response';
import { sendRequest } from './send-request';
import { type RequestTestResult, skip, test, type TestHandler } from './test';
import { toUrlObject } from './urls';
import { checkIfUrlIncludesTag } from './utils';

export class InsomniaObject {
  public environment: Environment;
  public collectionVariables: Environment;
  public baseEnvironment: Environment;
  public variables: Variables;
  public request: ScriptRequest;
  public cookies: CookieObject;
  public info: RequestInfo;
  public response?: ScriptResponse;
  public execution: Execution;
  public vault?: Vault;

  public clientCertificates: ClientCertificate[];
  private _expect = expect;
  private _test = test;
  private _skip = skip;

  private iterationData: Environment;
  // TODO: follows will be enabled after Insomnia supports them
  private globals: Environment;
  private baseGlobals: Environment;
  private _settings: Settings;

  private requestTestResults: RequestTestResult[];

  private parentFolders: ParentFolders;

  constructor(rawObj: {
    globals: Environment;
    baseGlobals: Environment;
    iterationData: Environment;
    environment: Environment;
    baseEnvironment: Environment;
    variables: Variables;
    request: ScriptRequest;
    settings: Settings;
    clientCertificates: ClientCertificate[];
    cookies: CookieObject;
    requestInfo: RequestInfo;
    execution: Execution;
    response?: ScriptResponse;
    parentFolders: ParentFolders;
    vault?: Vault;
  }) {
    this.globals = rawObj.globals;
    this.baseGlobals = rawObj.baseGlobals;
    this.environment = rawObj.environment;
    this.baseEnvironment = rawObj.baseEnvironment;
    this.collectionVariables = this.baseEnvironment; // collectionVariables is mapped to baseEnvironment
    this.iterationData = rawObj.iterationData;
    this.variables = rawObj.variables;
    this.cookies = rawObj.cookies;
    this.response = rawObj.response;
    this.execution = rawObj.execution;
    this.vault = rawObj.vault;

    this.info = rawObj.requestInfo;
    this.request = rawObj.request;
    this._settings = rawObj.settings;
    this.clientCertificates = rawObj.clientCertificates;

    this.requestTestResults = new Array<RequestTestResult>();
    this.parentFolders = rawObj.parentFolders;

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop === 'test') {
          const testHandler: TestHandler = async (msg: string, fn: () => Promise<void>) => {
            await this._test(msg, fn, this.pushRequestTestResult);
          };
          testHandler.skip = async (msg: string, fn: () => Promise<void>) => {
            await this._skip(msg, fn, this.pushRequestTestResult);
          };

          return testHandler;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  sendRequest(request: string | ScriptRequest, cb: (error?: string, response?: ScriptResponse) => void) {
    return sendRequest(request, cb, this._settings);
  }

  test = () => {
    // this method is intercepted by the proxy above
  };

  private pushRequestTestResult = (testResult: RequestTestResult) => {
    this.requestTestResults = [...this.requestTestResults, testResult];
  };

  expect = (exp: boolean | number | string | object) => {
    return this._expect(exp);
  };

  get settings() {
    return;
  }

  toObject = () => {
    return {
      globals: this.globals.toObject(),
      baseGlobals: this.baseGlobals.toObject(),
      environment: this.environment.toObject(),
      baseEnvironment: this.baseEnvironment.toObject(),
      iterationData: this.iterationData.toObject(),
      variables: this.variables.localVarsToObject(),
      request: this.request,
      settings: this.settings,
      clientCertificates: this.clientCertificates,
      cookieJar: this.cookies.jar().toInsomniaCookieJar(),
      info: this.info.toObject(),
      response: this.response ? this.response.toObject() : undefined,
      requestTestResults: this.requestTestResults,
      execution: this.execution.toObject(),
      parentFolders: this.parentFolders.toObject(),
    };
  };
}

export async function initInsomniaObject(rawObj: RequestContext, log: (...args: any[]) => void) {
  // Mapping rule for the global environment:
  // - If global base environment is selected, both `baseGlobals` and `globals` point to the selected one.
  // - If one global sub environment is selected,  `baseGlobals` points to the base env of the selected one and `globals` points to the selected one.
  const baseGlobals = new Environment(rawObj.baseGlobals?.name || 'baseGlobals', rawObj.baseGlobals?.data || {});
  const globals =
    rawObj.globals?.id === rawObj.baseGlobals?.id
      ? baseGlobals
      : new Environment(rawObj.globals?.name || 'globals', rawObj.globals?.data || {});
  // Mapping rule for the environment and base environment:
  // - If base environment is selected, both `baseEnvironment` and `environment` point to the selected one.
  // - If one sub environment is selected,  `baseEnvironment` points to the base env and `environment` points to the selected one.
  const baseEnvironment = new Environment(rawObj.baseEnvironment.name || '', rawObj.baseEnvironment.data);
  // reuse baseEnvironment when the "selected environment" points to the base environment
  const environment =
    rawObj.baseEnvironment.id === rawObj.environment.id
      ? baseEnvironment
      : new Environment(rawObj.environment.name || '', rawObj.environment.data);
  if (rawObj.baseEnvironment.id === rawObj.environment.id) {
    log(
      'warning: No environment is selected, modification of insomnia.environment will be applied to the base environment.',
    );
  }
  // Mapping rule for the environment user uploaded in collection runner
  const iterationData = rawObj.iterationData
    ? new Environment(rawObj.iterationData.name, rawObj.iterationData.data)
    : new Environment('iterationData', {});
  const localVariables = rawObj.transientVariables
    ? new Environment(rawObj.transientVariables.name, rawObj.transientVariables.data)
    : new Environment('transientVariables', {});
  const enableVaultInScripts = rawObj.settings?.enableVaultInScripts || false;
  const vault = rawObj.vault
    ? new Vault('vault', rawObj.vault, enableVaultInScripts)
    : new Vault('vault', {}, enableVaultInScripts);
  const cookies = new CookieObject(rawObj.cookieJar);
  // TODO: update follows when post-request script and iterationData are introduced
  const requestInfo = new RequestInfo({
    eventName: rawObj.requestInfo.eventName || 'prerequest',
    iteration: rawObj.requestInfo.iteration || 1,
    iterationCount: rawObj.requestInfo.iterationCount || 0,
    requestName: rawObj.request.name,
    requestId: rawObj.request._id,
  });

  const parentFolders = new ParentFolders(
    rawObj.parentFolders.map(folderObj => new Folder(folderObj.id, folderObj.name, folderObj.environment)),
  );

  const variables = new Variables({
    baseGlobalVars: baseGlobals,
    globalVars: globals,
    environmentVars: environment,
    collectionVars: baseEnvironment,
    iterationDataVars: iterationData,
    folderLevelVars: parentFolders.getEnvironments(),
    localVars: localVariables,
  });

  // todo: find if theres a better way to get the best cert
  // (╯°□°）╯︵ ┻━┻
  const ifUrlIncludesTag = checkIfUrlIncludesTag(rawObj.request.url);
  const matchedCertificates = filterClientCertificates(rawObj.clientCertificates || [], rawObj.request.url);
  const initEmptyCert = ifUrlIncludesTag || matchedCertificates?.length === 0;
  if (initEmptyCert) {
    getExistingConsole().warn(
      'The URL contains tags or no matched certificate found, insomnia.request.certificate is initialized as an empty certificate.',
    );
  }
  const defaultCertificate = initEmptyCert
    ? {
        disabled: false,
        name: 'Default Certificate',
        matches: [],
        key: undefined,
        cert: undefined,
        passphrase: undefined,
        pfx: undefined,
      }
    : {
        disabled: matchedCertificates[0].disabled,
        name: 'The first matched certificate from Settings',
        matches: [matchedCertificates[0].host],
        key: { src: matchedCertificates[0].key || '' },
        cert: { src: matchedCertificates[0].cert || '' },
        passphrase: matchedCertificates[0].passphrase || undefined,
        pfx: { src: matchedCertificates[0].pfx || '' }, // PFX or PKCS12 Certificate
      };

  const reqUrl = toUrlObject(rawObj.request.url);
  const proxy = transformToSdkProxyOptions(
    reqUrl.protocol,
    rawObj.settings.httpProxy,
    rawObj.settings.httpsProxy,
    rawObj.settings.proxyEnabled,
    rawObj.settings.noProxy,
  );

  reqUrl.addQueryParams(
    rawObj.request.parameters.map(param => ({ key: param.name, value: param.value, disabled: param.disabled })),
  );

  const reqOpt: RequestOptions = {
    name: rawObj.request.name,
    url: reqUrl,
    method: rawObj.request.method,
    header: rawObj.request.headers.map((header: RequestHeader) => ({
      key: header.name,
      value: header.value,
      disabled: header.disabled,
    })),
    body: toScriptRequestBody(rawObj.request.body),
    auth: toPreRequestAuth(rawObj.request.authentication),
    proxy,
    certificate: defaultCertificate,
    pathParameters: rawObj.request.pathParameters,
  };
  const request = new ScriptRequest(reqOpt);
  const execution = new Execution({
    location: rawObj.execution.location,
    skipRequest: rawObj.execution.skipRequest,
    nextRequestIdOrName: rawObj.execution.nextRequestIdOrName,
  });

  const responseBody = await readBodyFromPath(rawObj.response);
  const response = rawObj.response ? toScriptResponse(request, rawObj.response, responseBody) : undefined;

  return new InsomniaObject({
    globals,
    baseGlobals,
    environment,
    baseEnvironment,
    iterationData,
    vault,
    variables,
    request,
    settings: rawObj.settings,
    clientCertificates: rawObj.clientCertificates,
    cookies,
    requestInfo,
    response,
    execution,
    parentFolders,
  });
}
