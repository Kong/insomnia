import React, { FC, useCallback } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import type { Request, RequestHeader } from '../../../models/request';
import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  bulk: boolean;
  isDisabled?: boolean;
}

export const RequestHeadersEditor: FC<Props> = ({
  bulk,
  isDisabled,
}) => {
  const request = useRouteLoaderData('request/:requestId') as Request | WebSocketRequest;
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };

  const handleBulkUpdate = useCallback((headersString: string) => {
    const headers: {
      name: string;
      value: string;
    }[] = [];

    const rows = headersString.split(/\n+/);
    for (const row of rows) {
      const [rawName, rawValue] = row.split(/:(.*)$/);
      const name = (rawName || '').trim();
      const value = (rawValue || '').trim();

      if (!name && !value) {
        continue;
      }

      headers.push({
        name,
        value,
      });
    }

    requestFetcher.submit({ headers },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update-hack`,
        method: 'post',
        encType: 'application/json',
      });
  }, [organizationId, projectId, requestFetcher, requestId, workspaceId]);

  let headersString = '';
  for (const header of request.headers) {
    // Make sure it's not disabled
    if (header.disabled) {
      continue;
    }
    // Make sure it's not blank
    if (!header.name && !header.value) {
      continue;
    }

    headersString += `${header.name}: ${header.value}\n`;
  }

  const onChangeHeaders = useCallback((headers: RequestHeader[]) => {
    requestFetcher.submit(JSON.stringify({ headers }),
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/update-hack`,
        method: 'post',
        encType: 'application/json',
      });
  }, [organizationId, projectId, requestFetcher, requestId, workspaceId]);

  if (bulk) {
    return (
      <div className="tall">
        <CodeEditor
          onChange={handleBulkUpdate}
          defaultValue={headersString}
          enableNunjucks
        />
      </div>
    );
  }

  return (
    <KeyValueEditor
      namePlaceholder="header"
      valuePlaceholder="value"
      descriptionPlaceholder="description"
      pairs={request.headers}
      handleGetAutocompleteNameConstants={getCommonHeaderNames}
      handleGetAutocompleteValueConstants={getCommonHeaderValues}
      onChange={onChangeHeaders}
      isDisabled={isDisabled}
      isWebSocketRequest={isWebSocketRequest(request)}
    />
  );
};
