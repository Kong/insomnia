import React, { FC, useCallback } from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import { RequestParameter } from '../../../models/request';
import { useRequestPatcher } from '../../hooks/use-request';
import { RequestLoaderData, WebSocketRequestLoaderData } from '../../routes/request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  bulk: boolean;
  disabled?: boolean;
}

export const RequestParametersEditor: FC<Props> = ({
  bulk,
  disabled = false,
}) => {
  const { requestId } = useParams() as { requestId: string };
  const { activeRequest } = useRouteLoaderData('request/:requestId') as RequestLoaderData | WebSocketRequestLoaderData;
  const patchRequest = useRequestPatcher();
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
    patchRequest(requestId, { parameters });
  }, [patchRequest, requestId]);

  let paramsString = '';
  for (const param of activeRequest.parameters) {
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
    patchRequest(requestId, { parameters });
  }, [patchRequest, requestId]);

  if (bulk) {
    return (
      <CodeEditor
        id="request-parameters-editor"
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
      pairs={activeRequest.parameters}
      onChange={onChangeParameter}
      isDisabled={disabled}
    />
  );
};
