import React, { FC, useCallback } from 'react';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { update } from '../../../models/helpers/request-operations';
import type { Request, RequestHeader } from '../../../models/request';
import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  bulk: boolean;
  isDisabled?: boolean;
  request: Request | WebSocketRequest;
}

export const RequestHeadersEditor: FC<Props> = ({
  request,
  bulk,
  isDisabled,
}) => {
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

    update(request, { headers });
  }, [request]);

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
    update(request, { headers });
  }, [request]);

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
  const isWSRequest = isWebSocketRequest(request);
  const wsHeaders = [
    { name: 'Connection', value: 'Upgrade', readOnly: true },
    { name: 'Upgrade', value: 'websocket', readOnly: true },
    { name: 'Sec-WebSocket-Key', value: '<calculated at runtime>', readOnly: true },
    { name: 'Sec-WebSocket-Version', value: '13', readOnly: true },
    { name: 'Sec-WebSocket-Extensions', value: 'permessage-deflate; client_max_window_bits', readOnly: true },
    ...request.headers,
  ];
  const headers = isWSRequest ? wsHeaders : request.headers;

  return (
    <div className="pad-bottom scrollable-container">
      <div className="scrollable">
        <KeyValueEditor
          sortable
          namePlaceholder="header"
          valuePlaceholder="value"
          descriptionPlaceholder="description"
          pairs={headers}
          handleGetAutocompleteNameConstants={getCommonHeaderNames}
          handleGetAutocompleteValueConstants={getCommonHeaderValues}
          onChange={onChangeHeaders}
          isDisabled={isDisabled}
          forceInput={isWSRequest}
        />
      </div>
    </div>
  );
};
