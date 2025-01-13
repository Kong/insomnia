import React from 'react';

import { type Environment, type EnvironmentKvPairData, EnvironmentType, getKVPairFromData, vaultEnvironmentPath, vaultEnvironmentRuntimePath } from '../../../models/environment';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../templating';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';

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

export function handleToggleEnvironmentType(
  isSelected: boolean,
  environment: Pick<Environment, 'data' | 'dataPropertyOrder' | 'kvPairData'>,
  isValidJSON: boolean,
  updateEnvironmentTypeRequest: (type: EnvironmentType, kvPairData: EnvironmentKvPairData[]) => void,
) {
  const newEnvironmentType = isSelected ? EnvironmentType.JSON : EnvironmentType.KVPAIR;
  // clear kvPairData when switch to json view, otherwise convert json data to kvPairData
  const kvPairData = isSelected ? [] : getKVPairFromData(environment.data, environment.dataPropertyOrder);
  const foundDisabledItem = isSelected && environment.kvPairData?.some(pair => !pair.enabled);
  const foundDuplicateNameItem = isSelected && environment.kvPairData?.some(
    (pair, idx) => environment.kvPairData?.slice(idx + 1).some(newPair => pair.name.trim() === newPair.name.trim() && newPair.enabled)
  );
  if (!isValidJSON && newEnvironmentType === EnvironmentType.KVPAIR) {
    showModal(AlertModal, {
      title: 'Error',
      message: 'Please modify and fix the JSON string error before switch to Table view',
    });
  } else if (foundDisabledItem || foundDuplicateNameItem) {
    showModal(AskModal, {
      title: 'Change Environment Type',
      message: (
        <>
          {foundDisabledItem && <p>All disabled items will be lost.</p>}
          {foundDuplicateNameItem && <p>Items with same name will be lost except the last one.</p>}
          <p>Are you sure to continue?</p>
        </>
      ),
      onDone: async (saidYes: boolean) => {
        if (saidYes) {
          updateEnvironmentTypeRequest(newEnvironmentType, kvPairData);
        }
      },
    });
  } else {
    updateEnvironmentTypeRequest(newEnvironmentType, kvPairData);
  }
}
