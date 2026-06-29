import type { MockServer } from 'insomnia-data';
import {
  CONTENT_TYPE_FORM_URLENCODED,
  CONTENT_TYPE_GRAPHQL,
  CONTENT_TYPE_JSON,
  isLinux,
  isMac,
  isWindows,
  METHOD_GET,
  platform,
} from 'insomnia-data/common';

import appConfig from '../../config/config.json';
import { version } from '../../package.json';

// In the renderer (nodeIntegration disabled) env vars come from the preload via window.env.
// In the inso CLI and main process, fall back to process.env.
const ENV = 'env';

// eslint-disable-next-line no-restricted-globals -- isomorphic: guarded by `typeof window`. Renderer reads env from the preload (`window.env`); main process, UtilityProcess and the inso CLI fall back to process.env.
const env = typeof window !== 'undefined' && window.env ? window.env : process[ENV];

export const INSOMNIA_GITLAB_REDIRECT_URI = env.INSOMNIA_GITLAB_REDIRECT_URI;
export const INSOMNIA_GITLAB_CLIENT_ID = env.INSOMNIA_GITLAB_CLIENT_ID;
export const INSOMNIA_GITLAB_API_URL = env.INSOMNIA_GITLAB_API_URL;
export const PLAYWRIGHT_TEST = env.PLAYWRIGHT_TEST;
export const OAUTH_WINDOW_SESSION_ID_KEY = 'current-oauth-session-id';

// App Stuff
export const getSkipOnboarding = () => env.INSOMNIA_SKIP_ONBOARDING;
export const getInsomniaSession = () => env.INSOMNIA_SESSION;
export const getInsomniaSecretKey = () => env.INSOMNIA_SECRET_KEY;
export const getInsomniaPublicKey = () => env.INSOMNIA_PUBLIC_KEY;
export const getInsomniaVaultSalt = () => env.INSOMNIA_VAULT_SALT;
export const getInsomniaVaultKey = () => env.INSOMNIA_VAULT_KEY;
export const getInsomniaVaultSrpSecret = () => env.INSOMNIA_VAULT_SRP_SECRET;
export const getAppVersion = () => version;
export const getProductName = () => appConfig.productName;
export const getAppSynopsis = () => appConfig.synopsis;
export const getAppId = () => appConfig.appId;
export const getAppBundlePlugins = () => appConfig.bundlePlugins;
// Must specify full `process.env.INSOMNIA_ENV` here because esbuild define is a build-time replacement and won't inject to runtime
export const getAppEnvironment = () => env.INSOMNIA_ENV || process.env.INSOMNIA_ENV || 'production';
export const isDevelopment = () => getAppEnvironment() === 'development';
export const allowUpdatesInDev = () => Boolean(env.ALLOW_UPDATES_IN_DEV);
export const getSegmentWriteKey = () =>
  appConfig.segmentWriteKeys[isDevelopment() || env.PLAYWRIGHT_TEST ? 'development' : 'production'];
export const getSentryDsn = () => appConfig.sentryDsn;
export const getCioWriteKey = () =>
  appConfig.cio[isDevelopment() || env.PLAYWRIGHT_TEST ? 'development' : 'production'].writeKey;
export const getCioSiteId = () =>
  appConfig.cio[isDevelopment() || env.PLAYWRIGHT_TEST ? 'development' : 'production'].siteId;
// Must specify full `process.env.BUILD_DATE` here because esbuild define is a build-time replacement and won't inject to runtime
export const getAppBuildDate = () => new Date((env.BUILD_DATE || process.env.BUILD_DATE) ?? '').toLocaleDateString();

export function updatesSupported() {
  // Updates are not supported on Linux
  if (isLinux) {
    return false;
  }

  // Updates are not supported for Windows portable binaries
  if (isWindows && env.PORTABLE_EXECUTABLE_DIR) {
    return false;
  }

  return true;
}

export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'readyToRestart';

export const getClientString = () => `${getAppEnvironment()}::${platform}::${getAppVersion()}`;

// Global Stuff
export const DEBOUNCE_MILLIS = 100;

export const CDN_INVALIDATION_TTL = 10_000; // 10 seconds

export const STATUS_CODE_PLUGIN_ERROR = -222;
export const LARGE_RESPONSE_MB = 5;
export const HUGE_RESPONSE_MB = 100;
export const FLEXIBLE_URL_REGEX =
  /^(http|https):\/\/[\wàâäèéêëîïôóœùûüÿçÀÂÄÈÉÊËÎÏÔŒÙÛÜŸÇ\-_.]+[/\wàâäèéêëîïôóœùûüÿçÀÂÄÈÉÊËÎÏÔŒÙÛÜŸÇ.\-+=:\][@%^*&!#?;$~'(),]*/;
export const CHECK_FOR_UPDATES_INTERVAL = 1000 * 60 * 60 * 24;

export const ACCEPTED_NODE_CA_FILE_EXTS = ['.pem', '.crt', '.cer', '.p12'];

export const LLM_BACKENDS = ['gguf', 'claude', 'openai', 'gemini', 'url'] as const;

// Available editor key map
export enum EditorKeyMap {
  default = 'default',
  emacs = 'emacs',
  sublime = 'sublime',
  vim = 'vim',
}

// Hotkey
// For an explanation of mnemonics on linux and windows see https://github.com/Kong/insomnia/pull/1221#issuecomment-443543435 & https://docs.microsoft.com/en-us/cpp/windows/defining-mnemonics-access-keys?view=msvc-160#mnemonics-access-keys
export const MNEMONIC_SYM = isMac ? '' : '&';

// Oauth redirect URL
export const getOauthRedirectUrl = () => env.OAUTH_REDIRECT_URL || 'https://app.insomnia.rest/oauth/redirect';
export const getOauthRelayUrl = () => env.OAUTH_RELAY_URL || 'https://app.insomnia.rest/oauth/relay';

// API
export const getApiBaseURL = () => env.INSOMNIA_API_URL || 'https://api.insomnia.rest';
export const getMockServiceURL = () => env.INSOMNIA_MOCK_API_URL || 'https://mock.insomnia.run';

export const getMockServiceBinURL = (mockServer: MockServer, path: string) => {
  if (!mockServer.useInsomniaCloud) {
    return `${mockServer.url}/bin/${mockServer._id}${path}`;
  }
  const baseUrl = getMockServiceURL();
  const url = new URL(baseUrl);
  url.host = mockServer._id.replace('_', '-') + '.' + url.host;
  return url.origin + path;
};

export const getAIServiceURL = () => env.INSOMNIA_AI_URL || 'https://ai-helper.insomnia.rest';
export const getKonnectApiUrl = () => env.KONNECT_API_URL || 'api.konghq.com';
export const getKonnectApiRegions = (): string[] => {
  const regions = (env.KONNECT_API_REGIONS ?? '')
    .split(',')
    .map((r: string) => r.trim())
    .filter(Boolean);
  return regions.length > 0 ? regions : ['us', 'eu', 'au', 'in', 'sg'];
};

// App website
export const getAppWebsiteBaseURL = () => env.INSOMNIA_APP_WEBSITE_URL || 'https://app.insomnia.rest';

// GitHub API
export const getGitHubRestApiUrl = () => env.INSOMNIA_GITHUB_REST_API_URL || 'https://api.github.com';
export const getGitHubGraphQLApiURL = () => env.INSOMNIA_GITHUB_API_URL || `${getGitHubRestApiUrl()}/graphql`;

// SYNC
export const DEFAULT_BRANCH_NAME = 'master';

// PLUGIN
export const PLUGIN_HUB_BASE = 'https://insomnia.rest/plugins';
export const NPM_PACKAGE_BASE = 'https://www.npmjs.com/package';

// UI Stuf
export const MIN_INTERFACE_FONT_SIZE = 8;
export const MAX_INTERFACE_FONT_SIZE = 24;
export const MIN_EDITOR_FONT_SIZE = 8;
export const MAX_EDITOR_FONT_SIZE = 24;
export const DEFAULT_SIDEBAR_SIZE = 25;

// Activities
export type GlobalActivity = 'spec' | 'debug' | 'unittest' | 'home';

export const isWorkspaceActivity = (activity?: string): activity is GlobalActivity =>
  isDesignActivity(activity) || isCollectionActivity(activity);

export const isDesignActivity = (activity?: string): activity is GlobalActivity => {
  switch (activity) {
    case 'spec':
    case 'debug':
    case 'unittest': {
      return true;
    }

    default: {
      return false;
    }
  }
};

export const isCollectionActivity = (activity?: string): activity is GlobalActivity => {
  switch (activity) {
    case 'debug': {
      return true;
    }

    default: {
      return false;
    }
  }
};

export const isValidActivity = (activity: string): activity is GlobalActivity => {
  switch (activity) {
    case 'spec':
    case 'debug':
    case 'unittest':
    case 'home': {
      return true;
    }

    default: {
      return false;
    }
  }
};

// HTTP Methods
export { METHOD_GET };
export const METHOD_POST = 'POST';
export const METHOD_PUT = 'PUT';
export const METHOD_PATCH = 'PATCH';
export const METHOD_DELETE = 'DELETE';
export const METHOD_OPTIONS = 'OPTIONS';
export const METHOD_HEAD = 'HEAD';
export const METHOD_QUERY = 'QUERY';
export const HTTP_METHODS = [
  METHOD_GET,
  METHOD_POST,
  METHOD_PUT,
  METHOD_PATCH,
  METHOD_DELETE,
  METHOD_QUERY,
  METHOD_OPTIONS,
  METHOD_HEAD,
];

// Additional methods
export const METHOD_GRPC = 'GRPC';

// Content Types
export { CONTENT_TYPE_FORM_URLENCODED, CONTENT_TYPE_GRAPHQL, CONTENT_TYPE_JSON } from 'insomnia-data/common';
export const CONTENT_TYPE_PLAINTEXT = 'text/plain';
export const CONTENT_TYPE_XML = 'application/xml';
export const CONTENT_TYPE_YAML = 'application/yaml';
export const CONTENT_TYPE_EVENT_STREAM = 'text/event-stream';
export const CONTENT_TYPE_EDN = 'application/edn';
export const CONTENT_TYPE_FORM_DATA = 'multipart/form-data';
export const CONTENT_TYPE_FILE = 'application/octet-stream';
export const CONTENT_TYPE_OTHER = '';
export const contentTypesMap: Record<string, string[]> = {
  [CONTENT_TYPE_EDN]: ['EDN', 'EDN'],
  [CONTENT_TYPE_FILE]: ['File', 'Binary File'],
  [CONTENT_TYPE_FORM_DATA]: ['Multipart', 'Multipart Form'],
  [CONTENT_TYPE_FORM_URLENCODED]: ['Form', 'Form URL Encoded'],
  [CONTENT_TYPE_GRAPHQL]: ['GraphQL', 'GraphQL Query'],
  [CONTENT_TYPE_JSON]: ['JSON', 'JSON'],
  [CONTENT_TYPE_OTHER]: ['Other', 'Other'],
  [CONTENT_TYPE_PLAINTEXT]: ['Plain', 'Plain'],
  [CONTENT_TYPE_XML]: ['XML', 'XML'],
  [CONTENT_TYPE_YAML]: ['YAML', 'YAML'],
};

export type AuthTypes =
  | 'none'
  | 'apikey'
  | 'oauth2'
  | 'oauth1'
  | 'basic'
  | 'digest'
  | 'bearer'
  | 'ntlm'
  | 'hawk'
  | 'iam'
  | 'netrc'
  | 'asap'
  | 'singleToken';

export const HAWK_ALGORITHM_SHA256 = 'sha256';
export const HAWK_ALGORITHM_SHA1 = 'sha1';

//oauth 1
export type OAuth1SignatureMethod = 'HMAC-SHA1' | 'RSA-SHA1' | 'HMAC-SHA256' | 'PLAINTEXT';

export const SIGNATURE_METHOD_HMAC_SHA1: OAuth1SignatureMethod = 'HMAC-SHA1';
export const SIGNATURE_METHOD_HMAC_SHA256: OAuth1SignatureMethod = 'HMAC-SHA256';
export const SIGNATURE_METHOD_RSA_SHA1: OAuth1SignatureMethod = 'RSA-SHA1';
export const SIGNATURE_METHOD_PLAINTEXT: OAuth1SignatureMethod = 'PLAINTEXT';

//oauth 2
export const GRANT_TYPE_AUTHORIZATION_CODE = 'authorization_code';
export const GRANT_TYPE_IMPLICIT = 'implicit';
export const GRANT_TYPE_PASSWORD = 'password';
export const GRANT_TYPE_CLIENT_CREDENTIALS = 'client_credentials';
export const GRANT_TYPE_REFRESH = 'refresh_token';
export const GRANT_TYPE_MCP_AUTH_FLOW = 'mcp_auth_flow';

export type AuthKeys =
  | 'access_token'
  | 'id_token'
  | 'client_id'
  | 'client_secret'
  | 'audience'
  | 'resource'
  | 'code_challenge'
  | 'code_challenge_method'
  | 'code_verifier'
  | 'code'
  | 'nonce'
  | 'error'
  | 'error_description'
  | 'error_uri'
  | 'expires_in'
  | 'grant_type'
  | 'password'
  | 'redirect_uri'
  | 'refresh_token'
  | 'response_type'
  | 'scope'
  | 'state'
  | 'token_type'
  | 'username'
  | 'xError'
  | 'xResponseId';

export const PKCE_CHALLENGE_S256 = 'S256';
export const PKCE_CHALLENGE_PLAIN = 'plain';

export type OAuth2AuthorizationStatusType = 'none' | 'getting_code' | 'getting_token';

// json-order constants
export const JSON_ORDER_PREFIX = '&';
export const JSON_ORDER_SEPARATOR = '~|';

// Sort Orders
export type SortOrder =
  | 'name-asc'
  | 'name-desc'
  | 'created-asc'
  | 'created-desc'
  | 'http-method'
  | 'type-desc'
  | 'type-asc'
  | 'type-manual';

export const SORT_ORDERS = [
  'type-manual',
  'name-asc',
  'name-desc',
  'created-asc',
  'created-desc',
  'http-method',
  'type-desc',
  'type-asc',
] as const;
export const sortOrderName: Record<SortOrder, string> = {
  'type-manual': 'Manual',
  'name-asc': 'Name Ascending (A-Z)',
  'name-desc': 'Name Descending (Z-A)',
  'created-asc': 'Oldest First',
  'created-desc': 'Newest First',
  'http-method': 'HTTP Method',
  'type-desc': 'Folders First',
  'type-asc': 'Requests First',
};

export const EXTERNAL_VAULT_PLUGIN_NAME = '@kong/insomnia-plugin-external-vault';
export const AI_PLUGIN_NAME = '@kong/insomnia-plugin-ai';

export type DashboardSortOrder = 'name-asc' | 'name-desc' | 'created-asc' | 'created-desc' | 'modified-desc';

export const DASHBOARD_SORT_ORDERS: DashboardSortOrder[] = [
  'modified-desc',
  'name-asc',
  'name-desc',
  'created-asc',
  'created-desc',
];

export const dashboardSortOrderName: Record<DashboardSortOrder, string> = {
  'name-asc': 'Name Ascending (A-Z)',
  'name-desc': 'Name Descending (Z-A)',
  'created-asc': 'Oldest First',
  'created-desc': 'Newest First',
  'modified-desc': 'Last Modified',
};

export function getMimeTypeFromContentType(contentType: string) {
  // Check if the Content-Type header is provided
  if (!contentType) {
    return null;
  }

  // Split the Content-Type header to separate MIME type from parameters
  const [mimePart] = contentType.split(';');

  // Trim any extra spaces
  const mimeType = mimePart.trim();

  return mimeType;
}
export function getContentTypeName(contentType?: string | null, useLong = false) {
  if (typeof contentType !== 'string') {
    return '';
  }
  for (const contentTypeKey in contentTypesMap) {
    if (contentType.includes(contentTypeKey) && contentTypeKey.length > 0) {
      return useLong ? contentTypesMap[contentTypeKey][1] : contentTypesMap[contentTypeKey][0];
    }
  }

  return useLong ? contentTypesMap[CONTENT_TYPE_OTHER][1] : contentTypesMap[CONTENT_TYPE_OTHER][0];
}

// Sourced from https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
export const RESPONSE_CODE_DESCRIPTIONS: Record<number, string> = {
  // Special
  [STATUS_CODE_PLUGIN_ERROR]: 'An Insomnia plugin threw an error which prevented the request from sending',
  // 100s
  100: 'This interim response indicates that everything so far is OK and that the client should continue with the request or ignore it if it is already finished.',
  101: 'This code is sent in response to an Upgrade: request header by the client and indicates the protocol the server is switching to.',
  // 200s
  200: 'The request has succeeded.',
  201: 'The request has succeeded and a new resource has been created as a result. This is typically the response sent after POST requests, or some PUT requests.',
  202: 'The request has been received but not yet acted upon. It is non-committal, meaning that there is no way in HTTP to later send an asynchronous response indicating the outcome of processing the request. It is intended for cases where another process or server handles the request, or for batch processing.',
  203: 'This response code means returned meta-information set is not exact set as available from the origin server, but collected from a local or a third party copy. Except this condition, 200 OK response should be preferred instead of this response.',
  204: 'There is no content to send for this request, but the headers may be useful. The user-agent may update its cached headers for this resource with the new ones.',
  205: 'This response code is sent after accomplishing request to tell user agent reset document view which sent this request.',
  206: 'This response code is used because of range header sent by the client to separate download into multiple streams.',
  207: 'A Multi-Status response conveys information about multiple resources in situations where multiple status codes might be appropriate.',
  208: 'Used inside a DAV: propstat response element to avoid enumerating the internal members of multiple bindings to the same collection repeatedly.',
  226: 'The server has fulfilled a GET request for the resource, and the response is a representation of the result of one or more instance-manipulations applied to the current instance.',
  // 300s
  300: 'The request has more than one possible responses. User-agent or user should choose one of them. There is no standardized way to choose one of the responses.',
  301: 'This response code means that URI of requested resource has been changed. Probably, new URI would be given in the response.',
  302: 'This response code means that URI of requested resource has been changed temporarily. New changes in the URI might be made in the future. Therefore, this same URI should be used by the client in future requests.',
  303: 'Server sent this response to directing client to get requested resource to another URI with an GET request.',
  304: 'This is used for caching purposes. It is telling to client that response has not been modified. So, client can continue to use same cached version of response.',
  305: 'This means requested response must be accessed by a proxy. This response code is not largely supported because of security reasons.',
  306: 'This response code is no longer used and is just reserved currently. It was used in a previous version of the HTTP 1.1 specification.',
  307: 'Server sent this response to directing client to get requested resource to another URI with same method that used prior request. This has the same semantic than the 302 Found HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request.',
  308: 'This means that the resource is now permanently located at another URI, specified by the Location: HTTP Response header. This has the same semantics as the 301 Moved Permanently HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request.',
  // 400s
  400: 'This response means that the server could not understand the request due to invalid syntax.',
  401: 'Authentication is needed to get the requested response. This is similar to 403, but is different in that authentication is possible.',
  402: 'This response code is reserved for future use. Initial aim for creating this code was using it for digital payment systems, but it is not used currently.',
  403: 'Client does not have access rights to the content, so the server is rejecting to give proper response.',
  404: 'Server cannot find requested resource. This response code is probably the most famous one due to how frequently it occurs on the web.',
  405: 'The request method is known by the server but has been disabled and cannot be used.',
  406: "This response is sent when the web server, after performing server-driven content negotiation, doesn't find any content following the criteria given by the user agent.",
  407: 'This is similar to 401 but authentication is needed to be done by a proxy.',
  408: 'This response is sent on an idle connection by some servers, even without any previous request by the client. It means that the server would like to shut down this unused connection. This response is used much more since some browsers, like Chrome or IE9, use HTTP pre-connection mechanisms to speed up surfing (see bug 881804, which tracks the future implementation of such a mechanism in Firefox). Also, note that some servers merely shut down the connection without sending this message.',
  409: 'This response is sent when a request conflicts with the current state of the server.',
  410: 'This response is sent when the requested content has been deleted from the server.',
  411: 'Server rejected the request because the Content-Length header field is not defined and the server requires it.',
  412: 'The client has indicated preconditions in its headers which the server does not meet.',
  413: 'Request entity is larger than limits defined by the server; the server might close the connection or return a Retry-After header field.',
  414: 'The URI requested by the client is longer than the server is willing to interpret.',
  415: 'The media format of the requested data is not supported by the server, so the server is rejecting the request.',
  416: "The range specified by the Range header field in the request can't be fulfilled; it's possible that the range is outside the size of the target URI's data.",
  417: "This response code means the expectation indicated by the Expect request header field can't be met by the server.",
  418: 'Any attempt to brew coffee with a teapot should result in the error code "418 I\'m a teapot". The resulting entity body MAY be short and stout.',
  421: 'The request was directed at a server that is not able to produce a response. This can be sent by a server that is not configured to produce responses for the combination of scheme and authority that are included in the request URI.',
  422: 'The request was well-formed but was unable to be followed due to semantic errors.',
  423: 'The resource that is being accessed is locked.',
  424: 'The request failed due to failure of a previous request.',
  426: 'The server refuses to perform the request using the current protocol but might be willing to do so after the client upgrades to a different protocol. The server MUST send an Upgrade header field in a 426 response to indicate the required protocol(s) (Section 6.7 of [RFC7230]).',
  428: "The origin server requires the request to be conditional. Intended to prevent \"the 'lost update' problem, where a client GETs a resource's state, modifies it, and PUTs it back to the server, when meanwhile a third party has modified the state on the server, leading to a conflict.\"",
  429: 'The user has sent too many requests in a given amount of time ("rate limiting").',
  431: 'The server is unwilling to process the request because its header fields are too large. The request MAY be resubmitted after reducing the size of the request header fields.',
  451: 'The user requests an illegal resource, such as a web page censored by a government.',
  // 500s
  500: "The server has encountered a situation it doesn't know how to handle.",
  501: 'The request method is not supported by the server and cannot be handled. The only methods that servers are required to support (and therefore that must not return this code) are GET and HEAD.',
  502: 'This error response means that the server, while working as a gateway to get a response needed to handle the request, got an invalid response.',
  503: 'The server is not ready to handle the request. Common causes are a server that is down for maintenance or that is overloaded. Note that together with this response, a user-friendly page explaining the problem should be sent. This responses should be used for temporary conditions and the Retry-After: HTTP header should, if possible, contain the estimated time before the recovery of the service. The webmaster must also take care about the caching-related headers that are sent along with this response, as these temporary condition responses should usually not be cached.',
  504: 'This error response is given when the server is acting as a gateway and cannot get a response in time.',
  505: 'The HTTP version used in the request is not supported by the server.',
  506: 'The server has an internal configuration error: transparent content negotiation for the request results in a circular reference.',
  507: 'The server has an internal configuration error: the chosen variant resource is configured to engage in transparent content negotiation itself, and is therefore not a proper end point in the negotiation process.',
  508: 'The server detected an infinite loop while processing the request.',
  509: 'The server has exceeded the bandwidth specified by the server administrator; this is often used by shared hosting providers to limit the bandwidth of customers.',
  510: 'Further extensions to the request are required for the server to fulfill it.',
  511: 'The 511 status code indicates that the client needs to authenticate to gain network access.',
  598: 'Used by some HTTP proxies to signal a network read timeout behind the proxy to a client in front of the proxy.',
  599: 'An error used by some HTTP proxies to signal a network connect timeout behind the proxy to a client in front of the proxy.',
};

export const RESPONSE_CODE_REASONS: Record<number, string> = {
  // Special
  [STATUS_CODE_PLUGIN_ERROR]: 'Plugin Error',
  // 100s
  100: 'Continue',
  101: 'Switching Protocols',
  // 200s
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  207: 'Multi-Status',
  208: 'Already Reported',
  226: 'IM Used',
  // 300s
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  306: 'Switch Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  // 400s
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a Teapot",
  421: 'Misdirected Request',
  422: 'Unprocessable Entity',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  // 500s
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  509: 'Bandwidth Limit Exceeded',
  510: 'Not Extended',
  511: 'Network Authentication Required',
  598: 'Network read timeout error',
  599: 'Network Connect Timeout Error',
};

// (ms) curently server timeout is 30s
export const INSOMNIA_FETCH_TIME_OUT = 30_000;

// channel names for real time events (websocket/socket-io/mcp)
export const REALTIME_EVENTS_CHANNELS = {
  READY_STATE: 'readyState',
  NEW_EVENT: 'newEventReceived',
  MCP_NOTIFICATION: 'mcpNotification',
};
