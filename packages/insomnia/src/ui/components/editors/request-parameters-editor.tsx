import React, { FC, useCallback } from 'react';

import { update } from '../../../models/helpers/request-operations';
import type { Request, RequestParameter } from '../../../models/request';
import { WebSocketRequest } from '../../../models/websocket-request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  bulk: boolean;
  request: Request | WebSocketRequest;
  disabled?: boolean;
}

export const RequestParametersEditor: FC<Props> = ({
  request,
  bulk,
  disabled = false,
}) => {
  const handleBulkUpdate = useCallback((paramsString: string) => {
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
    update(request, { parameters });
  }, [request]);

  let paramsString = '';
  for (const param of request.parameters) {
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

  const onChangeParameter = useCallback((parameters: RequestParameter[]) => {
    update(request, { parameters });
  }, [request]);

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
      pairs={request.parameters}
      onChange={onChangeParameter}
      isDisabled={disabled}
    />
  );
};
