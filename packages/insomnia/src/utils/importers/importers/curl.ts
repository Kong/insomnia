import { ControlOperator, parse, ParseEntry } from 'shell-quote';
import { URL } from 'url';

import { Converter, ImportRequest, Parameter, PostData } from '../entities';

export const id = 'curl';
export const name = 'cURL';
export const description = 'cURL command line tool';

let requestCount = 1;

const SUPPORTED_ARGS = [
  'url',
  'u',
  'user',
  'header',
  'H',
  'cookie',
  'b',
  'get',
  'G',
  'd',
  'data',
  'data-raw',
  'data-urlencode',
  'data-binary',
  'data-ascii',
  'form',
  'F',
  'request',
  'X',
];

type Pair = string | boolean;

interface PairsByName {
  [name: string]: Pair[];
}

const importCommand = (parseEntries: ParseEntry[]): ImportRequest => {
  // ~~~~~~~~~~~~~~~~~~~~~ //
  // Collect all the flags //
  // ~~~~~~~~~~~~~~~~~~~~~ //
  const pairsByName: PairsByName = {};
  const singletons: ParseEntry[] = [];

  // Start at 1 so we can skip the ^curl part
  for (let i = 1; i < parseEntries.length; i++) {
    const parseEntry = parseEntries[i];

    if (typeof parseEntry === 'string' && parseEntry.match(/^-{1,2}[\w-]+/)) {
      const isSingleDash = parseEntry[0] === '-' && parseEntry[1] !== '-';
      let name = parseEntry.replace(/^-{1,2}/, '');

      if (!SUPPORTED_ARGS.includes(name)) {
        continue;
      }

      let value;
      const nextEntry = parseEntries[i + 1];
      if (isSingleDash && name.length > 1) {
        // Handle squished arguments like -XPOST
        value = name.slice(1);
        name = name.slice(0, 1);
      } else if (typeof nextEntry === 'string' && !nextEntry.startsWith('-')) {
        // Next arg is not a flag, so assign it as the value
        value = nextEntry;
        i++; // Skip next one
      } else {
        value = true;
      }

      if (!pairsByName[name]) {
        pairsByName[name] = [value];
      } else {
        pairsByName[name].push(value);
      }
    } else if (parseEntry) {
      singletons.push(parseEntry);
    }
  }

  // ~~~~~~~~~~~~~~~~~ //
  // Build the request //
  // ~~~~~~~~~~~~~~~~~ //

  /// /////// Url & parameters //////////
  let parameters: Parameter[] = [];
  let url = '';

  try {
    const urlValue = getPairValue(
      pairsByName,
      (singletons[0] as string) || '',
      ['url'],
    );
    const { searchParams, href, search } = new URL(urlValue);
    parameters = Array.from(searchParams.entries()).map(([name, value]) => ({
      name,
      value,
      disabled: false,
    }));

    url = href.replace(search, '').replace(/\/$/, '');
  } catch (error) {}

  /// /////// Authentication //////////
  const [username, password] = getPairValue(pairsByName, '', [
    'u',
    'user',
  ]).split(/:(.*)$/);

  const authentication = username
    ? {
      username: username.trim(),
      password: password.trim(),
    }
    : {};

  /// /////// Headers //////////
  const headers = [
    ...((pairsByName.header as string[] | undefined) || []),
    ...((pairsByName.H as string[] | undefined) || []),
  ].map(header => {
    const [name, value] = header.split(/:(.*)$/);
    // remove final colon from header name if present
    if (!value) {
      return {
        name: name.trim().replace(/;$/, ''),
        value: '',
      };
    }
    return {
      name: name.trim(),
      value: value.trim(),
    };
  });

  /// /////// Cookies //////////
  const cookieHeaderValue = [
    ...((pairsByName.cookie as string[] | undefined) || []),
    ...((pairsByName.b as string[] | undefined) || []),
  ]
    .map(str => {
      const name = str.split('=', 1)[0];
      const value = str.replace(`${name}=`, '');
      return `${name}=${value}`;
    })
    .join('; ');

  // Convert cookie value to header
  const existingCookieHeader = headers.find(
    header => header.name.toLowerCase() === 'cookie',
  );

  if (cookieHeaderValue && existingCookieHeader) {
    // Has existing cookie header, so let's update it
    existingCookieHeader.value += `; ${cookieHeaderValue}`;
  } else if (cookieHeaderValue) {
    // No existing cookie header, so let's make a new one
    headers.push({
      name: 'Cookie',
      value: cookieHeaderValue,
    });
  }

  /// /////// Body (Text or Blob) //////////
  const dataParameters = pairsToDataParameters(pairsByName);
  const contentTypeHeader = headers.find(
    header => header.name.toLowerCase() === 'content-type',
  );
  const mimeType = contentTypeHeader
    ? contentTypeHeader.value.split(';')[0]
    : null;

  /// /////// Body (Multipart Form Data) //////////
  const formDataParams = [
    ...((pairsByName.form as string[] | undefined) || []),
    ...((pairsByName.F as string[] | undefined) || []),
  ].map(str => {
    const [name, value] = str.split('=');
    const item: Parameter = {
      name,
    };

    if (value.indexOf('@') === 0) {
      item.fileName = value.slice(1);
      item.type = 'file';
    } else {
      item.value = value;
      item.type = 'text';
    }

    return item;
  });

  /// /////// Body //////////
  const body: PostData = mimeType ? { mimeType } : {};
  const bodyAsGET = getPairValue(pairsByName, false, ['G', 'get']);

  if (dataParameters.length !== 0 && bodyAsGET) {
    parameters.push(...dataParameters);
  } else if (dataParameters && mimeType === 'application/x-www-form-urlencoded') {
    body.params = dataParameters.map(parameter => {
      return {
        ...parameter,
        name: decodeURIComponent(parameter.name || ''),
        value: decodeURIComponent(parameter.value || ''),
      };
    });
  } else if (dataParameters.length !== 0) {
    body.text = dataParameters.map(parameter => `${parameter.name}${parameter.value}`).join('&');
    body.mimeType = mimeType || '';
  } else if (formDataParams.length) {
    body.params = formDataParams;
    body.mimeType = mimeType || 'multipart/form-data';
  }

  /// /////// Method //////////
  let method = getPairValue(pairsByName, '__UNSET__', [
    'X',
    'request',
  ]).toUpperCase();

  if (method === '__UNSET__') {
    method = body.text || body.params ? 'POST' : 'GET';
  }

  const count = requestCount++;
  return {
    _id: `__REQ_${count}__`,
    _type: 'request',
    parentId: '__WORKSPACE_ID__',
    name: url || `cURL Import ${count}`,
    parameters,
    url,
    method,
    headers,
    authentication,
    body,
  };
};

/**
 * cURL supported -d, and --date[suffix] flags.
 */
const dataFlags = [
  /**
   * https://curl.se/docs/manpage.html#-d
   */
  'd',
  'data',

  /**
   * https://curl.se/docs/manpage.html#--data-raw
   */
  'data-raw',

  /**
   * https://curl.se/docs/manpage.html#--data-urlencode
   */
  'data-urlencode',

  /**
   * https://curl.se/docs/manpage.html#--data-binary
   */
  'data-binary',

  /**
   * https://curl.se/docs/manpage.html#--data-ascii
   */
  'data-ascii',
];

/**
 * Parses pairs supporting only flags dictated by {@link dataFlags}
 *
 * @param keyedPairs pairs with cURL flags as keys.
 */
const pairsToDataParameters = (keyedPairs: PairsByName): Parameter[] => {
  let dataParameters: Parameter[] = [];

  for (const flagName of dataFlags) {
    const pairs = keyedPairs[flagName];

    if (!pairs || pairs.length === 0) {
      continue;
    }

    switch (flagName) {
      case 'd':
      case 'data':
      case 'data-ascii':
      case 'data-binary':
        dataParameters = dataParameters.concat(pairs.flatMap(pair => pairToParameters(pair, true)));
        break;
      case 'data-raw':
        dataParameters = dataParameters.concat(pairs.flatMap(pair => pairToParameters(pair)));
        break;
      case 'data-urlencode':
        dataParameters = dataParameters.concat(pairs.flatMap(pair => pairToParameters(pair, true))
          .map(parameter => {
            if (parameter.type === 'file') {
              return parameter;
            }

            return {
              ...parameter,
              value: encodeURIComponent(parameter.value ?? ''),
            };
          }));
        break;
      default:
        throw new Error(`unhandled data flag ${flagName}`);
    }
  }

  return dataParameters;
};

/**
 * Converts pairs (that could include multiple via `&`) into {@link Parameter}s. This
 * method supports both `@filename` and `name@filename`.
 *
 * @param pair command line value
 * @param allowFiles whether to allow the `@` to support include files
 */
const pairToParameters = (pair: Pair, allowFiles = false): Parameter[] => {
  if (typeof pair === 'boolean') {
    return [{ name: '', value: pair.toString() }];
  }

  return pair.split('&').map(pair => {
    if (pair.includes('@') && allowFiles) {
      const [name, fileName] = pair.split('@');
      return { name, fileName, type: 'file' };
    }

    const [name, value] = pair.split('=');
    if (!value || !pair.includes('=')) {
      return { name: '', value: pair };
    }

    return { name, value };
  });
};

const getPairValue = <T extends string | boolean>(
  parisByName: PairsByName,
  defaultValue: T,
  names: string[],
) => {
  for (const name of names) {
    if (parisByName[name] && parisByName[name].length) {
      return parisByName[name][0] as T;
    }
  }

  return defaultValue;
};

export const convert: Converter = rawData => {
  requestCount = 1;

  if (!rawData.match(/^\s*curl /)) {
    return null;
  }

  // Parse the whole thing into one big tokenized list
  const parseEntries = parse(rawData.replace(/\n/g, ' '));

  // ~~~~~~~~~~~~~~~~~~~~~~ //
  // Aggregate the commands //
  // ~~~~~~~~~~~~~~~~~~~~~~ //
  const commands: ParseEntry[][] = [];

  let currentCommand: ParseEntry[] = [];

  for (const parseEntry of parseEntries) {
    if (typeof parseEntry === 'string') {
      if (parseEntry.startsWith('$')) {
        currentCommand.push(parseEntry.slice(1, Infinity));
      } else {
        currentCommand.push(parseEntry);
      }
      continue;
    }

    if ((parseEntry as { comment: string }).comment) {
      continue;
    }

    const { op } = parseEntry as
      | { op: 'glob'; pattern: string }
      | { op: ControlOperator };

    // `;` separates commands
    if (op === ';') {
      commands.push(currentCommand);
      currentCommand = [];
      continue;
    }

    if (op?.startsWith('$')) {
      // Handle the case where literal like -H $'Header: \'Some Quoted Thing\''
      const str = op.slice(2, op.length - 1).replace(/\\'/g, "'");

      currentCommand.push(str);
      continue;
    }

    if (op === 'glob') {
      currentCommand.push(
        (parseEntry as { op: 'glob'; pattern: string }).pattern,
      );
      continue;
    }

    // Not sure what else this could be, so just keep going
  }

  // Push the last unfinished command
  commands.push(currentCommand);

  const requests: ImportRequest[] = commands
    .filter(command => command[0] === 'curl')
    .map(importCommand);

  return requests;
};
