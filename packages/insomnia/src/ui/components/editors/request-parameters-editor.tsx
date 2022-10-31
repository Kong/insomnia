import { invariant } from '@remix-run/router';
import React, { FC } from 'react';
import { useSelector } from 'react-redux';

import { updateById } from '../../../models/helpers/request-operations';
import type {  RequestParameter } from '../../../models/request';
import { selectActiveRequest } from '../../redux/selectors';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  bulk: boolean;
  disabled?: boolean;
  requestId: string;
}

export const RequestParametersEditor: FC<Props> = ({
  bulk,
  disabled = false,
  requestId,
}) => {
  const parameters = useSelector(selectActiveRequest)?.parameters || [];
  const handleBulkUpdate = (paramsString: string) => {
    const parameters: {
      name: string;
      value: string;
    }[] = [];

    const rows = paramsString.split(/\n+/);
    for (const row of rows) {
      const [rawName, rawValue] = row.split(/:(.*)$/);
      const name = (rawName || '').trim();
      const value = (rawValue || '').trim();

      if (!name && !value) {
        continue;
      }

      parameters.push({
        name,
        value,
      });
    }
    updateById(requestId, { parameters });
  };

  let paramsString = '';
  for (const param of parameters) {
    // Make sure it's not disabled
    if (param.disabled) {
      continue;
    }
    // Make sure it's not blank
    if (!param.name && !param.value) {
      continue;
    }
    paramsString += `${param.name}: ${param.value}\n`;
  }
  console.log(paramsString);
  if (bulk) {
    return (
      <CodeEditor
        onChange={handleBulkUpdate}
        defaultValue={paramsString}
        enableNunjucks
        readOnly={disabled}
      />
    );
  }

  return (
    <KeyValueEditor
      allowMultiline
      namePlaceholder="name"
      valuePlaceholder="value"
      descriptionPlaceholder="description"
      pairs={parameters}
      onChange={(parameters: RequestParameter[]) => {
        console.log('change', parameters);
        updateById(requestId, { parameters });
      }}
      isDisabled={disabled}
    />
  );
};
