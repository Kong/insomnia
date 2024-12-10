import { CONTENT_TYPE_JSON, CONTENT_TYPE_PLAINTEXT, CONTENT_TYPE_XML } from '../../../common/constants';
import type { AuthTypeOAuth2 } from '../../../models/request';
import { forceBracketNotation } from '../../../templating/utils';
import { fakerFunctions } from '../../../ui/components/templating/faker-functions';
import type { Converter, ImportRequest, Parameter } from '../entities';
import type {
  Auth as V200Auth,
  EventList as V200EventList,
  Folder as V200Folder,
  FormParameter as V200FormParameter,
  Header as V200Header,
  HttpsSchemaGetpostmanComJsonCollectionV200 as V200Schema,
  Item as V200Item,
  Request1 as V200Request1,
  Url,
  UrlEncodedParameter as V200UrlEncodedParameter,
} from './postman-2.0.types';
import type {
  Auth as V210Auth,
  Auth1 as V210Auth1,
  EventList as V210EventList,
  Folder as V210Folder,
  FormParameter as V210FormParameter,
  Header as V210Header,
  HttpsSchemaGetpostmanComJsonCollectionV210 as V210Schema,
  Item as V210Item,
  QueryParam,
  Request1 as V210Request1,
  UrlEncodedParameter as V210UrlEncodedParameter,
} from './postman-2.1.types';

export const id = 'postman';
export const name = 'Postman';
export const description = 'Importer for Postman collections';

type PostmanCollection = V200Schema | V210Schema;
type EventList = V200EventList | V210EventList;

type Authentication = V200Auth | V210Auth;

type Body = V200Request1['body'] | V210Request1['body'];

type UrlEncodedParameter = V200UrlEncodedParameter | V210UrlEncodedParameter;

type FormParameter = V200FormParameter | V210FormParameter;

type Item = V200Item | V210Item;

type Folder = V200Folder | V210Folder;

type Header = V200Header | V210Header;

let requestCount = 1;
let requestGroupCount = 1;
const fakerTags = Object.keys(fakerFunctions);
const postmanTagRegexs = fakerTags.map(tag => ({ tag, regex: new RegExp(`\\{\\{\\$${tag}\\}\\}`, 'g') }));
// example: { 'guid' : '{% faker 'guid' %}' }
const postmanToNunjucksLookup = fakerTags
  .map(tag => ({ [tag]: `{% faker '${tag}' %}` }))
  .reduce((acc, obj) => ({ ...acc, ...obj }), {});

export const transformPostmanToNunjucksString = (inputString?: string | null) => {
  if (!inputString) {
    return '';
  }
  if (typeof inputString !== 'string') {
    return inputString;
  }
  const replaceFaker = postmanTagRegexs.reduce((transformedString, { tag, regex }) => {
    return transformedString.replace(regex, postmanToNunjucksLookup[tag]);
  }, inputString);
  return normaliseJsonPath(replaceFaker);
};

// old: {{ arr-name-with-dash }}
// new: {{ _['arr-name-with-dash'] }}
export const normaliseJsonPath = (input?: string) => {
  if (!input) {
    return '';
  }
  if (!input.includes('-')) {
    return input;
  }
  // Use a regular expression to find and replace the pattern
  return input.replace(/{{\s*([^ }]+)\s*[^}]*\s*}}/g, (_, match) => {
    // Replace hyphens with underscores within the match
    const replaced = forceBracketNotation('_', match);
    // Return the replaced pattern within the curly braces
    return `{{${replaced}}}`;
  });
};

const POSTMAN_SCHEMA_V2_0 =
  'https://schema.getpostman.com/json/collection/v2.0.0/collection.json';
const POSTMAN_SCHEMA_V2_1 =
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

const mapGrantTypeToInsomniaGrantType = (grantType: string) => {
  if (grantType === 'authorization_code_with_pkce') {
    return 'authorization_code';
  }

  if (grantType === 'password_credentials') {
    return 'password';
  }

  return grantType || 'authorization_code';
};

export function translateHandlersInScript(scriptContent: string): string {
  let translated = scriptContent;

  // Replace pm.* with insomnia.*
  // This is a simple implementation that only replaces the first instance of pm.* in the script
  let offset = 0;
  for (let i = 0; i < scriptContent.length - 2; i++) {
    const isPM = scriptContent.slice(i, i + 3) === 'pm.';
    const isPrevCharacterAlphaNumeric = i - 1 >= 0 && /[0-9a-zA-Z\_\$]/.test(scriptContent[i - 1]);
    if (isPM && !isPrevCharacterAlphaNumeric) {
      translated = translated.slice(0, i + offset) + 'insomnia.' + translated.slice(i + 3 + offset);
      offset += 6;
    }
  }

  return translated;
}

export class ImportPostman {
  collection;

  constructor(collection: PostmanCollection) {
    this.collection = collection;
  }

  importVariable = (variables: { [key: string]: string }[]) => {
    if (variables?.length === 0) {
      return null;
    }

    const variable: { [key: string]: string } = {};
    for (let i = 0; i < variables.length; i++) {
      const { key, value } = variables[i];
      if (key === undefined) {
        continue;
      }
      variable[key] = transformPostmanToNunjucksString(value);
    }
    return variable;
  };

  importItems = (
    items: PostmanCollection['item'],
    parentId = '__WORKSPACE_ID__',
  ): ImportRequest[] => {
    // @ts-expect-error this is because there are devergent behaviors for how the function treats this collection.  This is handled appropriately in the function itself in different branches.
    return items.reduce((accumulator: ImportRequest[], item: Item | Folder) => {
      if (Object.prototype.hasOwnProperty.call(item, 'request')) {
        return [...accumulator, this.importRequestItem(item as Item, parentId)];
      }

      const requestGroup = this.importFolderItem(item as Folder, parentId);
      return [
        ...accumulator,
        requestGroup,
        ...this.importItems(
          item.item as PostmanCollection['item'],
          requestGroup._id,
        ),
      ];
    }, []);
  };

  importPreRequestScript = (events: EventList | undefined): string => {
    if (events == null) {
      return '';
    }

    const preRequestEvent = events.find(
      event => event.listen === 'prerequest'
    );

    const scriptOrRows = preRequestEvent != null ? preRequestEvent.script : '';
    if (scriptOrRows == null || scriptOrRows === '') {
      return '';
    }

    const scriptContent = scriptOrRows.exec != null ?
      (Array.isArray(scriptOrRows.exec) ? scriptOrRows.exec.join('\n') : scriptOrRows.exec) :
      '';

    return translateHandlersInScript(scriptContent);
  };

  importAfterResponseScript = (events: EventList | undefined): string => {
    if (events == null) {
      return '';
    }

    const afterResponseEvent = events.find(
      event => event.listen === 'test'
    );

    const scriptOrRows = afterResponseEvent ? afterResponseEvent.script : '';
    if (!scriptOrRows) {
      return '';
    }

    const scriptContent = scriptOrRows.exec ?
      (Array.isArray(scriptOrRows.exec) ? scriptOrRows.exec.join('\n') : scriptOrRows.exec) :
      '';

    return translateHandlersInScript(scriptContent);
  };

  importRequestItem = (
    { request, name = '', event }: Item,
    parentId: string,
  ): ImportRequest => {
    if (typeof request === 'string') {
      return {};
    }

    const { authentication, headers } = this.importAuthentication(request.auth, request.header as Header[]);

    let parameters = [] as Parameter[];

    if (typeof request.url === 'object' && request.url?.query) {
      parameters = this.importParameters(request.url?.query);
    }

    const preRequestScript = this.importPreRequestScript(event);
    const afterResponseScript = this.importAfterResponseScript(event);

    // Add Content-Type header for raw body because we don't add it automatically when sending the request
    const body = this.importBody(request.body);
    if (
      request.body?.mode === 'raw' &&
      !headers.find(({ key }) => key.toLowerCase() === 'content-type') &&
      typeof body === 'object' &&
      body?.mimeType
    ) {
      headers.push({
        key: 'Content-Type',
        value: body.mimeType,
      });
    }

    return {
      parentId,
      _id: `__REQ_${requestCount++}__`,
      _type: 'request',
      name,
      description: (request.description as string) || '',
      url: transformPostmanToNunjucksString(this.importUrl(request.url)),
      parameters: parameters,
      method: request.method || 'GET',
      headers: headers.map(({ key, value, disabled, description }) => ({
        name: transformPostmanToNunjucksString(key),
        value: transformPostmanToNunjucksString(value),
        ...(typeof disabled !== 'undefined' ? { disabled } : {}),
        ...(typeof description !== 'undefined' ? { description } : {}),
      })),
      body,
      authentication,
      preRequestScript,
      afterResponseScript,
    };
  };

  importParameters = (parameters: QueryParam[]): Parameter[] => {
    if (!parameters || parameters?.length === 0) {
      return [];
    }
    return parameters.map(({ key, value, disabled }) => ({
      name: transformPostmanToNunjucksString(key),
      value: transformPostmanToNunjucksString(value),
      disabled: disabled || false,
    }) as Parameter);
  };

  importFolderItem = ({ name, description, event, auth }: Folder, parentId: string) => {
    const { authentication } = this.importAuthentication(auth);
    const preRequestScript = this.importPreRequestScript(event);
    const afterResponseScript = this.importAfterResponseScript(event);
    return {
      parentId,
      _id: `__GRP_${requestGroupCount++}__`,
      _type: 'request_group',
      name,
      description: description || '',
      preRequestScript,
      afterResponseScript,
      authentication,
    };
  };

  importCollection = (): ImportRequest[] => {
    const {
      item,
      info: { name, description },
      variable,
      auth,
      event,
    } = this.collection;

    const postmanVariable = this.importVariable((variable as { [key: string]: string }[]) || []);
    const { authentication } = this.importAuthentication(auth);
    const preRequestScript = this.importPreRequestScript(event);
    const afterResponseScript = this.importAfterResponseScript(event);

    const collectionFolder: ImportRequest = {
      parentId: '__WORKSPACE_ID__',
      _id: `__GRP_${requestGroupCount++}__`,
      _type: 'request_group',
      name,
      description: typeof description === 'string' ? description : '',
      authentication,
      preRequestScript,
      afterResponseScript,
    };

    if (postmanVariable) {
      collectionFolder.variable = postmanVariable;
    }

    return [collectionFolder, ...this.importItems(item, collectionFolder._id)];
  };

  importUrl = (url?: Url | string) => {
    if (!url) {
      return '';
    }

    // remove ? and everything after it if there are QueryParams strictly defined
    if (typeof url === 'object' && url.query && url.raw?.includes('?')) {
      return url.raw?.slice(0, url.raw.indexOf('?')) || '';
    }

    if (typeof url === 'object' && url.raw) {
      return url.raw;
    }

    if (typeof url === 'string') {
      return url;
    }
    return '';
  };

  importBody = (body: Body): ImportRequest['body'] => {
    if (!body) {
      return {};
    }

    switch (body.mode) {
      case 'raw':
        let language: string | undefined = undefined;
        if (
          typeof body.options?.raw === 'object' &&
          body.options?.raw &&
          'language' in body.options?.raw &&
          typeof body.options.raw.language === 'string'
        ) {
          language = body.options.raw.language;
        }
        return this.importBodyRaw(body.raw, language);

      case 'urlencoded':
        return this.importBodyFormUrlEncoded(body.urlencoded);

      case 'formdata':
        // TODO: Handle this as properly as multipart/form-data
        return this.importBodyFormdata(body.formdata);

      case 'graphql':
        return this.importBodyGraphQL(body.graphql);

      default:
        return {};
    }
  };

  importBodyFormdata = (formdata?: FormParameter[]) => {
    const { schema } = this.collection.info;

    const params = formdata?.map(
      ({ key, value, type, enabled, disabled, src }) => {
        const item: Parameter = {
          type,
          name: transformPostmanToNunjucksString(key),
        };

        if (schema === POSTMAN_SCHEMA_V2_0) {
          item.disabled = !enabled;
        } else if (schema === POSTMAN_SCHEMA_V2_1) {
          item.disabled = !!disabled;
        }

        if (type === 'file') {
          item.fileName = src as string;
        } else if (typeof value === 'string') {
          item.value = transformPostmanToNunjucksString(value);
        } else {
          item.value = value as string;
        }

        return item;
      },
    );

    return {
      params,
      mimeType: 'multipart/form-data',
    };
  };

  importBodyFormUrlEncoded = (
    urlEncoded?: UrlEncodedParameter[],
  ): ImportRequest['body'] => {
    const { schema } = this.collection.info;

    const params = urlEncoded?.map(({ key, value, enabled, disabled }) => {
      const item: Parameter = {
        value: transformPostmanToNunjucksString(value),
        name: transformPostmanToNunjucksString(key),
      };

      if (schema === POSTMAN_SCHEMA_V2_0) {
        item.disabled = !enabled;
      } else if (schema === POSTMAN_SCHEMA_V2_1) {
        item.disabled = !!disabled;
      }

      return item;
    });

    return {
      params,
      mimeType: 'application/x-www-form-urlencoded',
    };
  };

  importBodyRaw = (raw?: string, language?: string) => {
    if (raw === '') {
      return {};
    }

    let mimeType;
    switch (language) {
      case 'xml':
        mimeType = CONTENT_TYPE_XML;
        break;
      case 'text':
        mimeType = CONTENT_TYPE_PLAINTEXT;
        break;
      case 'json':
        mimeType = CONTENT_TYPE_JSON;
        break;
      // TODO: we do not support these types yet
      case 'javascript':
      case 'html':
      default:
        mimeType = CONTENT_TYPE_PLAINTEXT;
    }

    return {
      mimeType,
      text: transformPostmanToNunjucksString(raw),
    };
  };

  importBodyGraphQL = (graphql?: Record<string, unknown>) => {
    if (!graphql) {
      return {};
    }

    return {
      mimeType: 'application/graphql',
      text: transformPostmanToNunjucksString(JSON.stringify(graphql)),
    };
  };

  importAuthentication = (authentication?: Authentication | null, originalHeaders: Header[] = []) => {
    const isAuthorizationHeader = ({ key }: Header) => key === 'Authorization';
    const authorizationHeader = originalHeaders.find(isAuthorizationHeader)?.value;

    // It is a business logic decision to remove the "Authorization" header.
    // If you think about it, this makes sense because if you've used Insomnia to fill out an Authorization form (e.g. Basic Auth), you wouldn't then also want the header to be added separately.
    // If users want to manually set up these headers they still absolutely can, of course, but we try to keep things simple and help users out.
    // const headers = originalHeaders.filter(h => !isAuthorizationHeader(h));

    // preserve the original headers according to requirements from 'Progressive' INS-4269
    const headers = originalHeaders;

    if (!authentication) {
      if (authorizationHeader) {
        switch (authorizationHeader?.substring(0, authorizationHeader.indexOf(' '))) {

          case 'Bearer': // will work for OAuth2 as well
            return {
              authentication: this.importBearerAuthenticationFromHeader(authorizationHeader),
              headers,
            };

          case 'Basic':
            return {
              authentication: this.importBasicAuthenticationFromHeader(authorizationHeader),
              headers,
            };

          case 'AWS4-HMAC-SHA256':
            return this.importАwsv4AuthenticationFromHeader(authorizationHeader, headers);

          case 'Digest':
            return {
              authentication: this.importDigestAuthenticationFromHeader(authorizationHeader),
              headers,
            };

          case 'OAuth':
            return {
              authentication: this.importOauth1AuthenticationFromHeader(authorizationHeader),
              headers,
            };

          default:
            return {
              authentication: {},
              headers,
            };
        }
      }
      return {
        authentication: {},
        headers,
      };
    }

    switch (authentication.type) {
      case 'awsv4':
        return {
          authentication: this.importAwsV4Authentication(authentication),
          headers,
        };

      case 'basic':
        return {
          authentication: this.importBasicAuthentication(authentication),
          headers,
        };

      case 'bearer':
        return {
          authentication: this.importBearerTokenAuthentication(authentication),
          headers,
        };

      case 'digest':
        return {
          authentication: this.importDigestAuthentication(authentication),
          headers,
        };

      case 'oauth1':
        return {
          authentication: this.importOauth1Authentication(authentication),
          headers,
        };

      case 'oauth2':
        return {
          authentication: this.importOauth2Authentication(authentication),
          headers,
        };

      case 'apikey':
        return {
          authentication: this.importApiKeyAuthentication(authentication),
          headers,
        };

      default:
        return {
          authentication: {},
          headers: originalHeaders,
        };
    }
  };

  importAwsV4Authentication = (auth: Authentication) => {
    if (!auth.awsv4) {
      return {};
    }

    const item = {
      type: 'iam',
      disabled: false,
      accessKeyId: 'aws-access-key',
      region: 'aws-region',
      secretAccessKey: 'aws-secret-key',
      service: 'aws-service-name',
      sessionToken: 'aws-session-token',
    };

    const { schema } = this.collection.info;
    if (schema === POSTMAN_SCHEMA_V2_0) {
      const awsv4 = auth.awsv4 as V200Auth['awsv4'];
      item.accessKeyId = awsv4?.accessKey as string;
      item.region = awsv4?.region as string;
      item.secretAccessKey = awsv4?.secretKey as string;
      item.service = awsv4?.service as string;
      item.sessionToken = awsv4?.sessionToken as string;
    }

    if (schema === POSTMAN_SCHEMA_V2_1) {
      const awsv4 = auth.awsv4 as V210Auth['awsv4'];
      item.accessKeyId = this.findValueByKey(awsv4, 'accessKey');
      item.region = this.findValueByKey(awsv4, 'region');
      item.secretAccessKey = this.findValueByKey(awsv4, 'secretKey');
      item.service = this.findValueByKey(awsv4, 'service');
      item.sessionToken = this.findValueByKey(awsv4, 'sessionToken');
    }

    return item;
  };

  /**
   * example of AWS header:
   * @example AWS4-HMAC-SHA256 Credential=<accessKeyId>/20220110/<region>/<service>/aws4_request, SignedHeaders=accept;content-type;host;x-amz-date;x-amz-security-token, Signature=ed270ed6ad1cad3513f6edad9692e4496e321e44954c70a86504eea5e0ef1ff5
   */
  importАwsv4AuthenticationFromHeader = (authHeader: string, headers: Header[]) => {
    if (!authHeader) {
      return {
        authentication: {},
        headers,
      };
    }
    const isAMZSecurityTokenHeader = ({ key }: Header) => key === 'X-Amz-Security-Token';
    const sessionToken = headers?.find(isAMZSecurityTokenHeader)?.value;
    const credentials = RegExp(/(?<=Credential=).*/).exec(authHeader)?.[0].split('/');

    return {
      authentication: {
        type: 'iam',
        disabled: false,
        accessKeyId: credentials?.[0],
        region: credentials?.[2],
        secretAccessKey: '',
        service: credentials?.[3],
        ...(sessionToken ? { sessionToken } : {}),
      },
      headers: headers.filter(h => !isAMZSecurityTokenHeader(h)),
    };
  };

  importBasicAuthentication = (auth: Authentication) => {
    if (!auth.basic) {
      return {};
    }

    const item = {
      type: 'basic',
      disabled: false,
      username: '',
      password: '',
    };
    const { schema } = this.collection.info;

    if (schema === POSTMAN_SCHEMA_V2_0) {
      const basic = auth.basic as V200Auth['basic'];
      item.username = basic?.username as string;
      item.password = basic?.password as string;
    }

    if (schema === POSTMAN_SCHEMA_V2_1) {
      const basic = auth.basic as V210Auth['basic'];
      item.username = this.findValueByKey(basic, 'username');
      item.password = this.findValueByKey(basic, 'password');
    }

    return item;
  };

  importBasicAuthenticationFromHeader = (authHeader: string) => {
    if (!authHeader) {
      return {};
    }

    const authStringIndex = authHeader.trim().replace(/\s+/g, ' ').indexOf(' ');
    const hasEncodedAuthString = authStringIndex !== -1;
    const encodedAuthString = hasEncodedAuthString ? authHeader.substring(authStringIndex + 1) : '';
    const authString = Buffer.from(encodedAuthString, 'base64').toString();
    const item = {
      type: 'basic',
      disabled: false,
      username: RegExp(/.+?(?=\:)/).exec(authString)?.[0],
      password: RegExp(/(?<=\:).*/).exec(authString)?.[0],
    };
    item.username = transformPostmanToNunjucksString(item.username);
    item.password = transformPostmanToNunjucksString(item.password);

    return item;
  };

  importBearerTokenAuthentication = (auth: Authentication) => {
    if (!auth.bearer) {
      return {};
    }

    const item = {
      type: 'bearer',
      disabled: false,
      token: '',
      prefix: '',
    };
    const { schema } = this.collection.info;

    if (schema === POSTMAN_SCHEMA_V2_0) {
      item.token = (auth.bearer as V200Auth['bearer'])?.token as string;
    }

    if (schema === POSTMAN_SCHEMA_V2_1) {
      item.token = this.findValueByKey(
        auth.bearer as V210Auth['bearer'],
        'token',
      );
    }
    item.token = transformPostmanToNunjucksString(item.token);
    return item;
  };

  importBearerAuthenticationFromHeader = (authHeader: string) => {
    if (!authHeader) {
      return {};
    }
    const authHeader2 = transformPostmanToNunjucksString(authHeader.replace(/\s+/, ' '));
    const tokenIndex = authHeader.indexOf(' ');
    return {
      type: 'bearer',
      disabled: false,
      token: tokenIndex + 1 ? authHeader2.substring(tokenIndex + 1) : '',
      prefix: '',
    };
  };

  importDigestAuthentication = (auth: Authentication) => {
    if (!auth.digest) {
      return {};
    }

    const item = {
      type: 'digest',
      disabled: false,
      username: '',
      password: '',
    };

    const { schema } = this.collection.info;

    if (schema === POSTMAN_SCHEMA_V2_0) {
      const digest = auth.digest as V200Auth['digest'];
      item.username = digest?.username as string;
      item.password = digest?.password as string;
    }

    if (schema === POSTMAN_SCHEMA_V2_1) {
      const digest = auth.digest as V210Auth1[];
      item.username = this.findValueByKey<V210Auth1>(digest, 'username');
      item.password = this.findValueByKey<V210Auth1>(digest, 'password');
    }

    return item;
  };

  // example: Digest username="Username", realm="Realm", nonce="Nonce", uri="//api/v1/report?start_date_min=2019-01-01T00%3A00%3A00%2B00%3A00&start_date_max=2019-01-01T23%3A59%3A59%2B00%3A00&projects[]=%2Fprojects%2F1&include_child_projects=1&search_query=meeting&columns[]=project&include_project_data=1&sort[]=-duration", algorithm="MD5", response="f3f762321e158aefe103529eda4ddb7c", opaque="Opaque"
  importDigestAuthenticationFromHeader = (authHeader: string) => {
    const item = {
      type: 'digest',
      disabled: false,
      username: RegExp(/(?<=username=")(.*?)(?=")/).exec(authHeader)?.[0],
      password: '',
    };

    return item;
  };

  importOauth1Authentication = (auth: Authentication) => {
    if (!auth.oauth1) {
      return {};
    }

    const item = {
      type: 'oauth1',
      disabled: false,
      callback: '',
      consumerKey: '',
      consumerSecret: '',
      nonce: '',
      privateKey: '',
      realm: '',
      signatureMethod: '',
      timestamp: '',
      tokenKey: '',
      tokenSecret: '',
      verifier: '',
      version: '',
    };

    const { schema } = this.collection.info;
    if (schema === POSTMAN_SCHEMA_V2_0) {
      const oauth1 = auth.oauth1 as V200Auth['oauth1'];
      item.consumerKey = oauth1?.consumerKey as string;
      item.consumerSecret = oauth1?.consumerSecret as string;
      item.nonce = oauth1?.nonce as string;
      item.realm = oauth1?.realm as string;
      item.signatureMethod = oauth1?.signatureMethod as string;
      item.timestamp = oauth1?.timestamp as string;
      item.tokenKey = oauth1?.token as string;
      item.tokenSecret = oauth1?.tokenSecret as string;
      item.version = oauth1?.version as string;
    }

    if (schema === POSTMAN_SCHEMA_V2_1) {
      const oauth1 = auth.oauth1 as V210Auth['oauth1'];
      item.consumerKey = this.findValueByKey(oauth1, 'consumerKey');
      item.consumerSecret = this.findValueByKey(oauth1, 'consumerSecret');
      item.nonce = this.findValueByKey(oauth1, 'nonce');
      item.realm = this.findValueByKey(oauth1, 'realm');
      item.signatureMethod = this.findValueByKey(oauth1, 'signatureMethod');
      item.timestamp = this.findValueByKey(oauth1, 'timestamp');
      item.tokenKey = this.findValueByKey(oauth1, 'token');
      item.tokenSecret = this.findValueByKey(oauth1, 'tokenSecret');
      item.version = this.findValueByKey(oauth1, 'version');
    }

    return item;
  };

  // Example: OAuth realm="Realm",oauth_consumer_key="Consumer%20Key",oauth_token="Access%20Token",oauth_signature_method="HMAC-SHA1",oauth_timestamp="Timestamp",oauth_nonce="Nonce",oauth_version="Version",oauth_callback="Callback%20URL",oauth_verifier="Verifier",oauth_signature="TwJvZVasVWTL6X%2Bz3lmuiyvaX2Q%3D"
  importOauth1AuthenticationFromHeader = (authHeader: string) => {

    const item = {
      type: 'oauth1',
      disabled: false,
      callback: RegExp(/(?<=oauth_callback=")(.*?)(?=")/).exec(authHeader)?.[0],
      consumerKey: RegExp(/(?<=oauth_consumer_key=")(.*?)(?=")/).exec(authHeader)?.[0],
      consumerSecret: '',
      nonce: RegExp(/(?<=oauth_nonce=")(.*?)(?=")/).exec(authHeader)?.[0],
      privateKey: '',
      realm: RegExp(/(?<=realm=")(.*?)(?=")/).exec(authHeader)?.[0],
      signatureMethod: RegExp(/(?<=oauth_signature_method=")(.*?)(?=")/).exec(authHeader)?.[0],
      timestamp: RegExp(/(?<=oauth_timestamp=")(.*?)(?=")/).exec(authHeader)?.[0],
      tokenKey: RegExp(/(?<=oauth_token=")(.*?)(?=")/).exec(authHeader)?.[0],
      tokenSecret: '',
      verifier: RegExp(/(?<=oauth_verifier=")(.*?)(?=")/).exec(authHeader)?.[0],
      version: RegExp(/(?<=oauth_version=")(.*?)(?=")/).exec(authHeader)?.[0],
    };

    return item;

  };

  importApiKeyAuthentication = (auth: Authentication) => {
    if (!auth.apikey) {
      return {};
    }
    const apikey = auth.apikey as V200Auth['apikey'] | V210Auth['apikey'];
    let keyVal, valueVal, inVal: string;
    if (Array.isArray(apikey)) {
      // V2.1
      keyVal = this.findValueByKey(apikey, 'key');
      valueVal = this.findValueByKey(apikey, 'value');
      inVal = this.findValueByKey(apikey, 'in');
    } else {
      // V2.0
      keyVal = apikey?.key as string;
      valueVal = apikey?.value as string;
      inVal = apikey?.in as string;
    }

    return {
      type: 'apikey',
      key: keyVal,
      value: valueVal,
      addTo: inVal === 'query' ? 'queryParams' : 'header',
      disabled: false,
    };
  };
  importOauth2Authentication = (auth: Authentication): AuthTypeOAuth2 | {} => {
    if (!auth.oauth2) {
      return {};
    }
    const { schema } = this.collection.info;
    // Workaround for https://github.com/Kong/insomnia/issues/4437
    // Note: We only support importing OAuth2 configuration from Postman v2.1
    if (schema === POSTMAN_SCHEMA_V2_1) {
      const oauth2 = auth.oauth2 as V210Auth['oauth2'];
      const grantTypeField = this.findValueByKey(oauth2, 'grant_type');
      const grantType = mapGrantTypeToInsomniaGrantType(grantTypeField);

      return {
        type: 'oauth2',
        disabled: false,
        pkceMethod: this.findValueByKey(oauth2, 'challengeAlgorithm'),
        state: this.findValueByKey(oauth2, 'state'),
        scope: this.findValueByKey(oauth2, 'scope'),
        tokenPrefix: this.findValueByKey(oauth2, 'headerPrefix'),
        credentialsInBody: this.findValueByKey(oauth2, 'addTokenTo') !== 'header',
        accessTokenUrl: this.findValueByKey(oauth2, 'accessTokenUrl'),
        authorizationUrl: this.findValueByKey(oauth2, 'authUrl'),
        grantType,
        password: this.findValueByKey(oauth2, 'password'),
        username: this.findValueByKey(oauth2, 'username'),
        usePkce: grantTypeField === 'authorization_code_with_pkce' ? true : undefined,
        clientId: this.findValueByKey(oauth2, 'clientId'),
        clientSecret: this.findValueByKey(oauth2, 'clientSecret'),
        redirectUrl: this.findValueByKey(oauth2, 'redirect_uri'),
      };
    }
    const item = {
      type: 'oauth2',
      disabled: true,
      accessTokenUrl: '',
      authorizationUrl: '',
      grantType: 'authorization_code',
      password: '',
      username: '',
    };
    return item;
  };

  findValueByKey = <T extends { key: string; value?: unknown }>(
    array?: T[],
    key?: keyof T,
  ) => {
    if (!array) {
      return '';
    }

    const obj = array.find(o => o.key === key);

    if (obj && typeof obj.value === 'string') {
      return obj.value || '';
    }

    return '';
  };
}

export const convert: Converter = rawData => {
  requestCount = 1;
  requestGroupCount = 1;

  try {
    const collection = JSON.parse(rawData) as PostmanCollection;

    if (
      collection.info.schema === POSTMAN_SCHEMA_V2_0 ||
      collection.info.schema === POSTMAN_SCHEMA_V2_1
    ) {
      const list = new ImportPostman(collection).importCollection();
      // make import order play nice with existing pattern of descending negavitve numbers (technically ascending) eg. -3, -2, -1
      const now = Date.now();
      const ordered = list.map((item, index) => ({
        ...item,
        metaSortKey: -1 * (now - index),
      }));
      return ordered;
    }
  } catch (error) {
    // Nothing
  }

  return null;
};
