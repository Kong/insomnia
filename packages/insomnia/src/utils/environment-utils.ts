import orderedJSON from 'json-order';

import { JSON_ORDER_SEPARATOR } from '../common/constants';
import { generateId } from '../common/misc';
import {
  type Environment,
  type EnvironmentKvPairData,
  EnvironmentKvPairDataType,
  vaultEnvironmentMaskValue,
  vaultEnvironmentPath,
  vaultEnvironmentRuntimePath,
} from '../models/environment';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../templating';

// NeDB field names cannot begin with '$' or contain a period '.'
// Docs: https://github.com/DeNA/nedb#inserting-documents
const INVALID_NEDB_KEY_REGEX = /^\$|\./;

export const ensureKeyIsValid = (key: string, isRoot: boolean): string | null => {
  if (key.match(INVALID_NEDB_KEY_REGEX)) {
    return `"${key}" cannot begin with '$' or contain a '.'`;
  }

  if (key === NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME && isRoot) {
    return `"${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}" is a reserved key`;
  }

  if (key === vaultEnvironmentPath && isRoot) {
    return `"${vaultEnvironmentPath}" is a reserved key`;
  }

  if (key === vaultEnvironmentRuntimePath && isRoot) {
    return `"${vaultEnvironmentRuntimePath}" is a reserved key`;
  }

  return null;
};

/**
 * Recursively check nested keys in and immediately return when an invalid key found
 */
export function checkNestedKeys(obj: Record<string, any>, isRoot = true): string | null {
  for (const key in obj) {
    let result: string | null = null;

    // Check current key
    result = ensureKeyIsValid(key, isRoot);

    // Exit if necessary
    if (result) {
      return result;
    }

    // Check nested keys
    if (typeof obj[key] === 'object') {
      result = checkNestedKeys(obj[key], false);
    }

    // Exit if necessary
    if (result) {
      return result;
    }
  }

  return null;
}

export function getKVPairFromData(data: Record<string, any>, dataPropertyOrder: Record<string, any> | null) {
  const ordered = orderedJSON.order(data, dataPropertyOrder, JSON_ORDER_SEPARATOR);
  const kvPair: EnvironmentKvPairData[] = [];
  Object.keys(ordered).forEach(key => {
    const val = ordered[key];
    // get all secret items from vaultEnvironmentPath
    if (key === vaultEnvironmentPath && typeof val === 'object' && !Array.isArray(val)) {
      Object.keys(val).forEach(secretKey => {
        kvPair.push({
          id: generateId('envPair'),
          name: secretKey,
          value: val[secretKey],
          type: EnvironmentKvPairDataType.SECRET,
          enabled: true,
        });
      });
    } else {
      const isValidObject = val && typeof val === 'object' && data !== null;
      kvPair.push({
        id: generateId('envPair'),
        name: key,
        value: isValidObject ? JSON.stringify(val) : String(val),
        type: isValidObject ? EnvironmentKvPairDataType.JSON : EnvironmentKvPairDataType.STRING,
        enabled: true,
      });
    }
  });
  return kvPair;
}

export function getDataFromKVPair(kvPair: EnvironmentKvPairData[]) {
  const data: Record<string, any> = {};
  kvPair.forEach(pair => {
    const { name, value, type, enabled } = pair;
    if (enabled) {
      if (type === EnvironmentKvPairDataType.SECRET) {
        if (!data[vaultEnvironmentPath]) {
          // create object storing all secret items
          data[vaultEnvironmentPath] = {};
        }
        data[vaultEnvironmentPath][name] = value;
      } else {
        data[name] = type === EnvironmentKvPairDataType.JSON ? JSON.parse(value) : value;
      }
    }
  });
  return {
    data,
    dataPropertyOrder: null,
  };
}

// mask vault environment variable if necessary
export const maskVaultEnvironmentData = (environment: Environment) => {
  if (environment.isPrivate) {
    const { data, kvPairData } = environment;
    const shouldMask = kvPairData?.some(pair => pair.type === EnvironmentKvPairDataType.SECRET);
    if (shouldMask) {
      kvPairData?.forEach(pair => {
        const { type } = pair;
        if (type === EnvironmentKvPairDataType.SECRET) {
          pair.value = vaultEnvironmentMaskValue;
        }
      });
      if (
        data &&
        typeof data === 'object' &&
        data[vaultEnvironmentPath] &&
        typeof data[vaultEnvironmentPath] === 'object'
      ) {
        Object.keys(data[vaultEnvironmentPath]).forEach(vaultKey => {
          data[vaultEnvironmentPath][vaultKey] = vaultEnvironmentMaskValue;
        });
      }
    }
  }
  return environment;
};
