import { Converter, ImportRequest, Parameter } from '../entities';
import {
  Auth as V200Auth,
  Folder as V200Folder,
  FormParameter as V200FormParameter,
  Header as V200Header,
  HttpsSchemaGetpostmanComJsonCollectionV200 as V200Schema,
  Item as V200Item,
  Request1 as V200Request1,
  UrlEncodedParameter as V200UrlEncodedParameter,
  Variable2 as V200Variable2,
} from './postman-2.0.types';
import {
  Auth as V210Auth,
  Auth1 as V210Auth1,
  Folder as V210Folder,
  FormParameter as V210FormParameter,
  Header as V210Header,
  HttpsSchemaGetpostmanComJsonCollectionV210 as V210Schema,
  Item as V210Item,
  Request1 as V210Request1,
  UrlEncodedParameter as V210UrlEncodedParameter,
  Variable2 as V210Variable2,
} from './postman-2.1.types';

export const id = 'postman';
export const name = 'Postman';
export const description = 'Importer for Postman collections';

type PostmanCollection = V200Schema | V210Schema;

type Variable = V200Variable2 | V210Variable2;

type Auth = V200Auth | V210Auth;

type Body = V200Request1['body'] | V210Request1['body'];

type UrlEncodedParameter = V200UrlEncodedParameter | V210UrlEncodedParameter;

type FormParameter = V200FormParameter | V210FormParameter;

type Item = V200Item | V210Item;

type Folder = V200Folder | V210Folder;

type Header = V200Header | V210Header;

let requestCount = 1;
let requestGroupCount = 1;

const POSTMAN_SCHEMA_V2_0 =
  'https://schema.getpostman.com/json/collection/v2.0.0/collection.json';
const POSTMAN_SCHEMA_V2_1 =
  'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

class ImportCollection {
  collection;

  constructor(collection: PostmanCollection) {
    this.collection = collection;
  }

  importVariable = (variables: Variable[]) => {
    if (variables?.length === 0) {
      return null;
    }

    const variable: { [key: string]: Variable['value'] } = {};
    for (let i = 0; i < variables.length; i++) {
      const key = variables[i].key;
      if (key === undefined) {
        continue;
      }
      variable[key] = variables[i].value;
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

  importRequestItem = (
    { request, name = '' }: Item,
    parentId: string,
  ): ImportRequest => {
    if (typeof request === 'string') {
      return {};
    }

    return {
      parentId,
      _id: `__REQ_${requestCount++}__`,
      _type: 'request',
      name,
      description: (request.description as string) || '',
      url: this.importUrl(request.url),
      method: request.method || 'GET',
      headers: ((request.header || []) as Header[])?.map(header => ({
        name: header.key,
        value: header.value,
      })),
      body: this.importBody(request.body),
      authentication: this.importAuthentication(request.auth),
    };
  };

  importFolderItem = ({ name, description }: Folder, parentId: string) => {
    return {
      parentId,
      _id: `__GRP_${requestGroupCount++}__`,
      _type: 'request_group',
      name,
      description: description || '',
    };
  };

  importCollection = (): ImportRequest[] => {
    const {
      item,
      info: { name, description },
      variable,
    } = this.collection;

    const postmanVariable = this.importVariable(variable || []);
    const collectionFolder: ImportRequest = {
      parentId: '__WORKSPACE_ID__',
      _id: `__GRP_${requestGroupCount++}__`,
      _type: 'request_group',
      name,
      description: typeof description === 'string' ? description : '',
    };

    if (postmanVariable) {
      collectionFolder.variable = postmanVariable;
    }

    return [collectionFolder, ...this.importItems(item, collectionFolder._id)];
  };

  importUrl = (url?: { raw?: string } | string) => {
    if (!url) {
      return '';
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
        return this.importBodyRaw(body.raw);

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
          name: key,
        };

        if (schema === POSTMAN_SCHEMA_V2_0) {
          item.disabled = !enabled;
        } else if (schema === POSTMAN_SCHEMA_V2_1) {
          item.disabled = !!disabled;
        }

        if (type === 'file') {
          item.fileName = src as string;
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
        value,
        name: key,
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

  importBodyRaw = (raw?: string) => {
    if (raw === '') {
      return {};
    }

    return {
      mimeType: '',
      text: raw,
    };
  };

  importBodyGraphQL = (graphql?: Record<string, unknown>) => {
    if (!graphql) {
      return {};
    }

    return {
      mimeType: 'application/graphql',
      text: JSON.stringify(graphql),
    };
  };

  importAuthentication = (auth?: Auth | null) => {
    if (!auth) {
      return {};
    }

    switch (auth.type) {
      case 'awsv4':
        return this.importAwsV4Authentication(auth);
      case 'basic':
        return this.importBasicAuthentication(auth);
      case 'bearer':
        return this.importBearerTokenAuthentication(auth);
      case 'digest':
        return this.importDigestAuthentication(auth);
      case 'oauth1':
        return this.importOauth1Authentication(auth);
      case 'oauth2':
        return this.importOauth2Authentication(auth);
      default:
        return {};
    }
  };

  importAwsV4Authentication = (auth: Auth) => {
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

  importBasicAuthentication = (auth: Auth) => {
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

  importBearerTokenAuthentication = (auth: Auth) => {
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

    return item;
  };

  importDigestAuthentication = (auth: Auth) => {
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

  importOauth1Authentication = (auth: Auth) => {
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

  importOauth2Authentication = (auth: Auth) => {
    if (!auth.oauth2) {
      return {};
    } // Note: Postman v2.0 and v2.1 don't export any Oauth config. They only export the token
    // So just return a disabled and empty Oauth 2 configuration so the user can fill it in later.

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
      return new ImportCollection(collection).importCollection();
    }
  } catch (e) {
    // Nothing
  }

  return null;
};
