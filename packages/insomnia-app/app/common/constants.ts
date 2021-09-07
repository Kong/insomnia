import path from 'path';
import { ValueOf } from 'type-fest';

import appConfig from '../../config/config.json';
import { getDataDirectory } from './electron-helpers';

// App Stuff
export const getAppVersion = () => appConfig.version;
export const getAppLongName = () => appConfig.longName;
export const getAppName = () => appConfig.productName;
export const getAppDefaultTheme = () => appConfig.theme;
export const getAppDefaultLightTheme = () => appConfig.lightTheme;
export const getAppDefaultDarkTheme = () => appConfig.darkTheme;
export const getAppSynopsis = () => appConfig.synopsis;
export const getAppId = () => appConfig.appId;
export const getGoogleAnalyticsId = () => appConfig.gaId;
export const getGoogleAnalyticsLocation = () => appConfig.gaLocation;
export const getAppPlatform = () => process.platform;
export const isMac = () => getAppPlatform() === 'darwin';
export const isLinux = () => getAppPlatform() === 'linux';
export const isWindows = () => getAppPlatform() === 'win32';
export const getAppEnvironment = () => process.env.INSOMNIA_ENV || 'production';
export const isDevelopment = () => getAppEnvironment() === 'development';
export const getSegmentWriteKey = () => appConfig.segmentWriteKeys[isDevelopment() ? 'development' : 'production'];
export const getAppReleaseDate = () => new Date(process.env.RELEASE_DATE ?? '').toLocaleDateString();

export const getBrowserUserAgent = () => encodeURIComponent(
  String(window.navigator.userAgent)
    .replace(new RegExp(`${getAppId()}\\/\\d+\\.\\d+\\.\\d+ `), '')
    .replace(/Electron\/\d+\.\d+\.\d+ /, ''),
).replace('%2C', ',');

export function updatesSupported() {
  // Updates are not supported on Linux
  if (isLinux()) {
    return false;
  }

  // Updates are not supported for Windows portable binaries
  if (isWindows() && process.env.PORTABLE_EXECUTABLE_DIR) {
    return false;
  }

  return true;
}

export const getClientString = () => `${getAppEnvironment()}::${getAppPlatform()}::${getAppVersion()}`;
export const changelogUrl = () => appConfig.changelogUrl;

// Global Stuff
export const DB_PERSIST_INTERVAL = 1000 * 60 * 30; // Compact every once in a while
export const DEBOUNCE_MILLIS = 100;
export const REQUEST_TIME_TO_SHOW_COUNTER = 1; // Seconds

/**
 * A number in milliseconds representing the time required to setup and teardown a request.
 *
 * Should not be used for anything a user may rely on for performance metrics of any kind.
 *
 * While this isn't a perfect "magic-number" (it can be as low as 120ms and as high as 300) it serves as a rough average.
 *
 * For initial introduction, see https://github.com/Kong/insomnia/blob/8aa274d21b351c4710f0bb833cba7deea3d56c29/app/ui/components/ResponsePane.js#L100
*/
export const REQUEST_SETUP_TEARDOWN_COMPENSATION = 200;
export const STATUS_CODE_PLUGIN_ERROR = -222;
export const LARGE_RESPONSE_MB = 5;
export const HUGE_RESPONSE_MB = 100;
export const FLEXIBLE_URL_REGEX = /^(http|https):\/\/[\wàâäèéêëîïôóœùûüÿçÀÂÄÈÉÊËÎÏÔŒÙÛÜŸÇ\-_.]+[/\wàâäèéêëîïôóœùûüÿçÀÂÄÈÉÊËÎÏÔŒÙÛÜŸÇ.\-+=:\][@%^*&!#?;$]*/;
export const CHECK_FOR_UPDATES_INTERVAL = 1000 * 60 * 60 * 3; // 3 hours
export const PLUGIN_PATH = path.join(getDataDirectory(), 'plugins');
export const AUTOBIND_CFG = {
  methodsToIgnore: [
    'UNSAFE_componentWillMount',
    'UNSAFE_componentWillReceiveProps',
    'UNSAFE_componentWillUpdate',
  ],
};

// Available editor key map
export const EDITOR_KEY_MAP_DEFAULT = 'default';
export const EDITOR_KEY_MAP_EMACS = 'emacs';
export const EDITOR_KEY_MAP_SUBLIME = 'sublime';
export const EDITOR_KEY_MAP_VIM = 'vim';

// Hotkey
// For an explanation of mnemonics on linux and windows see https://github.com/Kong/insomnia/pull/1221#issuecomment-443543435 & https://docs.microsoft.com/en-us/cpp/windows/defining-mnemonics-access-keys?view=msvc-160#mnemonics-access-keys
export const MNEMONIC_SYM = isMac() ? '' : '&';
export const CTRL_SYM = isMac() ? '⌃' : 'Ctrl';
export const ALT_SYM = isMac() ? '⌥' : 'Alt';
export const SHIFT_SYM = isMac() ? '⇧' : 'Shift';
export const META_SYM = isMac() ? '⌘' : 'Super';

// Update
export const UPDATE_CHANNEL_STABLE = 'stable';
export const UPDATE_CHANNEL_BETA = 'beta';
export const UPDATE_URL_MAC = 'https://updates.insomnia.rest/builds/check/mac';
export const UPDATE_URL_WINDOWS = 'https://updates.insomnia.rest/updates/win';

// API
export const API_BASE_URL = 'https://api.insomnia.rest';

// SYNC
export const DEFAULT_BRANCH_NAME = 'master';

// PLUGIN
export const PLUGIN_HUB_BASE = 'https://insomnia.rest/plugins';
export const NPM_PACKAGE_BASE = 'https://www.npmjs.com/package';

// UI Stuf
export const MAX_SIDEBAR_REMS = 45;
export const MIN_SIDEBAR_REMS = 0.75;
export const COLLAPSE_SIDEBAR_REMS = 3;
export const SIDEBAR_SKINNY_REMS = 10;
export const MAX_PANE_WIDTH = 0.99;
export const MIN_PANE_WIDTH = 0.01;
export const MAX_PANE_HEIGHT = 0.99;
export const MIN_PANE_HEIGHT = 0.01;
export const DEFAULT_PANE_WIDTH = 0.5;
export const DEFAULT_PANE_HEIGHT = 0.5;
export const DEFAULT_SIDEBAR_WIDTH = 19;
export const MIN_INTERFACE_FONT_SIZE = 8;
export const MAX_INTERFACE_FONT_SIZE = 24;
export const MIN_EDITOR_FONT_SIZE = 8;
export const MAX_EDITOR_FONT_SIZE = 24;

// Activities
export type GlobalActivity =
  | 'spec'
  | 'debug'
  | 'unittest'
  | 'home'
  | 'migration'
  | 'onboarding'
  | 'analytics';
export const ACTIVITY_SPEC: GlobalActivity = 'spec';
export const ACTIVITY_DEBUG: GlobalActivity = 'debug';
export const ACTIVITY_UNIT_TEST: GlobalActivity = 'unittest';
export const ACTIVITY_HOME: GlobalActivity = 'home';
export const ACTIVITY_ONBOARDING: GlobalActivity = 'onboarding';
export const ACTIVITY_MIGRATION: GlobalActivity = 'migration';
export const ACTIVITY_ANALYTICS: GlobalActivity = 'analytics';
export const DEPRECATED_ACTIVITY_INSOMNIA = 'insomnia';

export const isWorkspaceActivity = (activity?: string): activity is GlobalActivity =>
  isDesignActivity(activity) || isCollectionActivity(activity);

export const isDesignActivity = (activity?: string): activity is GlobalActivity => {
  switch (activity) {
    case ACTIVITY_SPEC:
    case ACTIVITY_DEBUG:
    case ACTIVITY_UNIT_TEST:
      return true;

    case ACTIVITY_HOME:
    case ACTIVITY_ONBOARDING:
    case ACTIVITY_MIGRATION:
    case ACTIVITY_ANALYTICS:
    default:
      return false;
  }
};

export const isCollectionActivity = (activity?: string): activity is GlobalActivity => {
  switch (activity) {
    case ACTIVITY_DEBUG:
      return true;

    case ACTIVITY_SPEC:
    case ACTIVITY_UNIT_TEST:
    case ACTIVITY_HOME:
    case ACTIVITY_ONBOARDING:
    case ACTIVITY_MIGRATION:
    case ACTIVITY_ANALYTICS:
    default:
      return false;
  }
};

export const isValidActivity = (activity: string): activity is GlobalActivity => {
  switch (activity) {
    case ACTIVITY_SPEC:
    case ACTIVITY_DEBUG:
    case ACTIVITY_UNIT_TEST:
    case ACTIVITY_HOME:
    case ACTIVITY_ONBOARDING:
    case ACTIVITY_MIGRATION:
    case ACTIVITY_ANALYTICS:
      return true;

    default:
      return false;
  }
};

// HTTP Methods
export const METHOD_GET = 'GET';
export const METHOD_POST = 'POST';
export const METHOD_PUT = 'PUT';
export const METHOD_PATCH = 'PATCH';
export const METHOD_DELETE = 'DELETE';
export const METHOD_OPTIONS = 'OPTIONS';
export const METHOD_HEAD = 'HEAD';
export const HTTP_METHODS = [
  METHOD_GET,
  METHOD_POST,
  METHOD_PUT,
  METHOD_PATCH,
  METHOD_DELETE,
  METHOD_OPTIONS,
  METHOD_HEAD,
];

// Additional methods
export const METHOD_GRPC = 'GRPC';

// Preview Modes
export const PREVIEW_MODE_FRIENDLY = 'friendly';
export const PREVIEW_MODE_SOURCE = 'source';
export const PREVIEW_MODE_RAW = 'raw';
const previewModeMap = {
  [PREVIEW_MODE_FRIENDLY]: ['Preview', 'Visual Preview'],
  [PREVIEW_MODE_SOURCE]: ['Source', 'Source Code'],
  [PREVIEW_MODE_RAW]: ['Raw', 'Raw Data'],
};
export const PREVIEW_MODES = Object.keys(previewModeMap);

// Content Types
export const CONTENT_TYPE_JSON = 'application/json';
export const CONTENT_TYPE_PLAINTEXT = 'text/plain';
export const CONTENT_TYPE_XML = 'application/xml';
export const CONTENT_TYPE_YAML = 'text/yaml';
export const CONTENT_TYPE_EDN = 'application/edn';
export const CONTENT_TYPE_FORM_URLENCODED = 'application/x-www-form-urlencoded';
export const CONTENT_TYPE_FORM_DATA = 'multipart/form-data';
export const CONTENT_TYPE_FILE = 'application/octet-stream';
export const CONTENT_TYPE_GRAPHQL = 'application/graphql';
export const CONTENT_TYPE_OTHER = '';
const contentTypesMap = {
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

// Auth Types
export const AUTH_NONE = 'none';
export const AUTH_OAUTH_2 = 'oauth2';
export const AUTH_OAUTH_1 = 'oauth1';
export const AUTH_BASIC = 'basic';
export const AUTH_DIGEST = 'digest';
export const AUTH_BEARER = 'bearer';
export const AUTH_NTLM = 'ntlm';
export const AUTH_HAWK = 'hawk';
export const AUTH_AWS_IAM = 'iam';
export const AUTH_NETRC = 'netrc';
export const AUTH_ASAP = 'asap';
export const HAWK_ALGORITHM_SHA256 = 'sha256';
export const HAWK_ALGORITHM_SHA1 = 'sha1';

// json-order constants
export const JSON_ORDER_PREFIX = '&';
export const JSON_ORDER_SEPARATOR = '~|';

// HTTP version codes
export const HttpVersions = {
  V1_0: 'V1_0',
  V1_1: 'V1_1',
  V2_0: 'V2_0',
  v3: 'v3',
  default: 'default',
} as const;
export type HttpVersion = ValueOf<typeof HttpVersions>;

const authTypesMap = {
  [AUTH_BASIC]: ['Basic', 'Basic Auth'],
  [AUTH_DIGEST]: ['Digest', 'Digest Auth'],
  [AUTH_NTLM]: ['NTLM', 'Microsoft NTLM'],
  [AUTH_BEARER]: ['Bearer', 'Bearer Token'],
  [AUTH_OAUTH_1]: ['OAuth 1', 'OAuth 1.0'],
  [AUTH_OAUTH_2]: ['OAuth 2', 'OAuth 2.0'],
  [AUTH_HAWK]: ['Hawk', 'Hawk'],
  [AUTH_AWS_IAM]: ['AWS', 'AWS IAM v4'],
  [AUTH_ASAP]: ['ASAP', 'Atlassian ASAP'],
  [AUTH_NETRC]: ['Netrc', 'Netrc File'],
} as const;

// Sort Orders
export type SortOrder =
  | 'name-asc'
  | 'name-desc'
  | 'created-asc'
  | 'created-desc'
  | 'http-method'
  | 'type-desc'
  | 'type-asc';
export const SORT_NAME_ASC = 'name-asc';
export const SORT_NAME_DESC = 'name-desc';
export const SORT_CREATED_ASC = 'created-asc';
export const SORT_CREATED_DESC = 'created-desc';
export const SORT_MODIFIED_ASC = 'modified-asc';
export const SORT_MODIFIED_DESC = 'modified-desc';
export const SORT_HTTP_METHOD = 'http-method';
export const SORT_TYPE_DESC = 'type-desc';
export const SORT_TYPE_ASC = 'type-asc';
export const SORT_ORDERS = [
  SORT_NAME_ASC,
  SORT_NAME_DESC,
  SORT_CREATED_ASC,
  SORT_CREATED_DESC,
  SORT_HTTP_METHOD,
  SORT_TYPE_DESC,
  SORT_TYPE_ASC,
];
export const sortOrderName: Record<SortOrder, string> = {
  [SORT_NAME_ASC]: 'Name Ascending (A-Z)',
  [SORT_NAME_DESC]: 'Name Descending (Z-A)',
  [SORT_CREATED_ASC]: 'Oldest First',
  [SORT_CREATED_DESC]: 'Newest First',
  [SORT_HTTP_METHOD]: 'HTTP Method',
  [SORT_TYPE_DESC]: 'Folders First',
  [SORT_TYPE_ASC]: 'Requests First',
};

export type DashboardSortOrder =
  | 'name-asc'
  | 'name-desc'
  | 'created-asc'
  | 'created-desc'
  | 'modified-desc';

export const DASHBOARD_SORT_ORDERS = [
  SORT_MODIFIED_DESC,
  SORT_NAME_ASC,
  SORT_NAME_DESC,
  SORT_CREATED_ASC,
  SORT_CREATED_DESC,
];

export const dashboardSortOrderName: Record<DashboardSortOrder, string> = {
  [SORT_NAME_ASC]: 'Name Ascending (A-Z)',
  [SORT_NAME_DESC]: 'Name Descending (Z-A)',
  [SORT_CREATED_ASC]: 'Oldest First',
  [SORT_CREATED_DESC]: 'Newest First',
  [SORT_MODIFIED_DESC]: 'Last Modified',
};

export function getPreviewModeName(previewMode, useLong = false) {
  if (previewModeMap.hasOwnProperty(previewMode)) {
    return useLong ? previewModeMap[previewMode][1] : previewModeMap[previewMode][0];
  } else {
    return '';
  }
}

export function getContentTypeName(contentType?: string | null, useLong = false) {
  if (typeof contentType !== 'string') {
    return '';
  }

  if (contentTypesMap.hasOwnProperty(contentType)) {
    return useLong ? contentTypesMap[contentType][1] : contentTypesMap[contentType][0];
  }

  return useLong ? contentTypesMap[CONTENT_TYPE_OTHER][1] : contentTypesMap[CONTENT_TYPE_OTHER][0];
}

export function getAuthTypeName(authType, useLong = false) {
  if (authTypesMap.hasOwnProperty(authType)) {
    return useLong ? authTypesMap[authType][1] : authTypesMap[authType][0];
  } else {
    return '';
  }
}

export function getContentTypeFromHeaders(headers, defaultValue: string | null = null) {
  if (!Array.isArray(headers)) {
    return null;
  }

  const header = headers.find(({ name }) => name.toLowerCase() === 'content-type');
  return header ? header.value : defaultValue;
}

// Sourced from https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
export const RESPONSE_CODE_DESCRIPTIONS = {
  // Special
  [STATUS_CODE_PLUGIN_ERROR]:
    'An Insomnia plugin threw an error which prevented the request from sending',
  // 100s
  100: 'This interim response indicates that everything so far is OK and that the client should continue with the request or ignore it if it is already finished.',
  101: 'This code is sent in response to an Upgrade: request header by the client and indicates the protocol the server is switching to. It was introduced to allow migration to an incompatible protocol version, and it is not in common use.',
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
  510: 'Further extensions to the request are required for the server to fulfill it.',
  511: 'The 511 status code indicates that the client needs to authenticate to gain network access.',
};

export const RESPONSE_CODE_REASONS = {
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
  510: 'Not Extended',
  511: 'Network Authentication Required',
};

export const WORKSPACE_ID_KEY = '__WORKSPACE_ID__';
export const BASE_ENVIRONMENT_ID_KEY = '__BASE_ENVIRONMENT_ID__';
export const EXPORT_TYPE_REQUEST = 'request';
export const EXPORT_TYPE_GRPC_REQUEST = 'grpc_request';
export const EXPORT_TYPE_REQUEST_GROUP = 'request_group';
export const EXPORT_TYPE_UNIT_TEST_SUITE = 'unit_test_suite';
export const EXPORT_TYPE_UNIT_TEST = 'unit_test';
export const EXPORT_TYPE_WORKSPACE = 'workspace';
export const EXPORT_TYPE_COOKIE_JAR = 'cookie_jar';
export const EXPORT_TYPE_ENVIRONMENT = 'environment';
export const EXPORT_TYPE_API_SPEC = 'api_spec';
export const EXPORT_TYPE_PROTO_FILE = 'proto_file';
export const EXPORT_TYPE_PROTO_DIRECTORY = 'proto_directory';
