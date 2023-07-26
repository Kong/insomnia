import React, { FC, useCallback } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { Request, RequestParameter } from '../../../models/request';
import { WebSocketRequest } from '../../../models/websocket-request';
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
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const request = useRouteLoaderData('request/:requestId') as Request | WebSocketRequest;

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
    requestFetcher.submit({ parameters },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update`,
        method: 'post',
        encType: 'application/json',
      });
  }, [organizationId, projectId, requestFetcher, requestId, workspaceId]);

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
    requestFetcher.submit(JSON.stringify({ parameters }),
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update`,
        method: 'post',
        encType: 'application/json',
      });
  }, [organizationId, projectId, requestFetcher, requestId, workspaceId]);

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
