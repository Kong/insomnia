import {
  Converter,
  UNKNOWN,
  UNKNOWN_OBJ,
  ImportRequest,
  Header,
  Parameter,
} from '../entities';

export const id = 'insomnia-1';
export const name = 'Insomnia v1';
export const description = 'Legacy Insomnia format';

type Format = 'form' | 'json' | 'text' | 'xml';

interface Item {
  requests: UNKNOWN[];
  name?: string;
  environments?: {
    base: UNKNOWN_OBJ;
  };
  __insomnia?: {
    format: Format;
  };
  authentication?: {
    _type?: 'basic';
    username?: string;
    password?: string;
  };
  headers?: Header[];
  body:
    | string
    | {
        mimeType: string;
        text?: string;
        params?: Parameter[];
      };
  params: Parameter[];
  url?: string;
  method?: string;
}

export interface Insomnia1Data {
  __export_format: 1;
  items: Item[];
}

let requestCount = 1;
let requestGroupCount = 1;

const FORMAT_MAP: Record<Format, string> = {
  form: 'application/x-www-form-urlencoded',
  json: 'application/json',
  text: 'text/plain',
  xml: 'application/xml',
};

const importRequestGroupItem = (item: Item): ImportRequest => {
  const environment = item.environments?.base ?? {};

  const count = requestGroupCount++;
  return {
    _type: 'request_group',
    _id: `__GRP_${count}__`,
    parentId: '__WORKSPACE_ID__',
    environment,
    name: item.name || `Imported Folder ${count}`,
  };
};

const importRequestItem = (parentId?: string) => ({
  authentication: { username, password } = {},
  headers = [],
  __insomnia,
  body: itemBody,
  name,
  url = '',
  method = 'GET',
  params = [],
}: Item): ImportRequest => {
  let contentTypeHeader = headers.find(
    ({ name }) => name.toLowerCase() === 'content-type',
  );

  if (__insomnia?.format) {
    const contentType = FORMAT_MAP[__insomnia.format];

    if (!contentTypeHeader) {
      contentTypeHeader = {
        name: 'Content-Type',
        value: contentType,
      };
      headers.push(contentTypeHeader);
    }
  }

  let body = {};

  const isForm =
    contentTypeHeader &&
    (contentTypeHeader.value.match(/^application\/x-www-form-urlencoded/i) ||
      contentTypeHeader.value.match(/^multipart\/form-encoded/i));

  if (isForm) {
    const mimeType = contentTypeHeader ? contentTypeHeader.value.split(';')[0] : '';
    const params = (typeof itemBody === 'string' ? itemBody : '')
      .split('&')
      .map((param) => {
        const [name, value] = param.split('=');
        return {
          name: decodeURIComponent(name),
          value: decodeURIComponent(value || ''),
        };
      });
    body = {
      mimeType,
      params,
    };
  } else if (itemBody) {
    const mimeType = __insomnia?.format ? FORMAT_MAP[__insomnia?.format] : '';
    body = {
      mimeType,
      text: itemBody,
    };
  }

  const count = requestCount++;
  return {
    _type: 'request',
    _id: `__REQ_${count}__`,
    parentId,
    name: name || `Imported HAR ${count}`,
    url,
    method,
    body,
    parameters: params || [],
    headers,
    authentication: {
      password,
      username,
    },
  };
};

export const convert: Converter = (rawData) => {
  requestCount = 1;
  requestGroupCount = 1;
  let data;

  try {
    data = JSON.parse(rawData) as Insomnia1Data;
  } catch (error) {
    return null;
  }

  if (data.__export_format !== 1) {
    // Exit early if it's not the legacy format
    return null;
  }

  return data.items
    .map((item) => {
      const requestGroup = importRequestGroupItem(item);
      return [
        requestGroup,
        ...item.requests.map(importRequestItem(requestGroup._id)),
      ];
    })
    .flat();
};
