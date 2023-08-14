import React, { FC, useCallback } from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import type { RequestHeader } from '../../../models/request';
import { isWebSocketRequest } from '../../../models/websocket-request';
import { useRequestPatcher } from '../../hooks/use-request';
import { RequestLoaderData, WebSocketRequestLoaderData } from '../../routes/request';
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
  const { activeRequest } = useRouteLoaderData('request/:requestId') as RequestLoaderData | WebSocketRequestLoaderData;
  const patchRequest = useRequestPatcher();
  const { requestId } = useParams() as { requestId: string };

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
    patchRequest(requestId, { headers });
  }, [patchRequest, requestId]);

  let headersString = '';
  for (const header of activeRequest.headers) {
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
    patchRequest(requestId, { headers });
  }, [patchRequest, requestId]);

  if (bulk) {
    return (
      <div className="tall">
        <CodeEditor
          id="request-headers-editor"
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
      pairs={activeRequest.headers}
      handleGetAutocompleteNameConstants={getCommonHeaderNames}
      handleGetAutocompleteValueConstants={getCommonHeaderValues}
      onChange={onChangeHeaders}
      isDisabled={isDisabled}
      isWebSocketRequest={isWebSocketRequest(activeRequest)}
    />
  );
};
