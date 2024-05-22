import React, { FC, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { generateId } from '../../../common/misc';
import type { RequestHeader } from '../../../models/request';
import { useRequestGroupPatcher, useRequestPatcher } from '../../hooks/use-request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  headers: RequestHeader[];
  bulk: boolean;
  isDisabled?: boolean;
  requestType: 'Request' | 'RequestGroup' | 'WebSocketRequest';
}
const readOnlyWebsocketPairs = [
  { name: 'Connection', value: 'Upgrade' },
  { name: 'Upgrade', value: 'websocket' },
  { name: 'Sec-WebSocket-Key', value: '<calculated at runtime>' },
  { name: 'Sec-WebSocket-Version', value: '13' },
  { name: 'Sec-WebSocket-Extensions', value: 'permessage-deflate; client_max_window_bits' },
].map(pair => ({ ...pair, id: generateId('pair') }));
const readOnlyHttpPairs = [
  { name: 'Accept', value: '*/*' },
  { name: 'Host', value: '<calculated at runtime>' },
].map(pair => ({ ...pair, id: generateId('pair') }));

export const RequestHeadersEditor: FC<Props> = ({
  headers,
  bulk,
  isDisabled,
  requestType,
}) => {
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const patcher = requestType === 'RequestGroup' ? patchRequestGroup : patchRequest;
  const isWebSocketRequest = requestType === 'WebSocketRequest';
  const { requestId } = useParams() as { requestId: string };

  const handleBulkUpdate = useCallback((headersString: string) => {
    const headersArray: {
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

      headersArray.push({
        name,
        value,
      });
    }
    patcher(requestId, { headers: headersArray });
  }, [patcher, requestId]);

  let headersString = '';
  for (const header of headers) {
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
      pairs={headers}
      handleGetAutocompleteNameConstants={getCommonHeaderNames}
      handleGetAutocompleteValueConstants={getCommonHeaderValues}
      onChange={headers => patcher(requestId, { headers })}
      isDisabled={isDisabled}
      readOnlyPairs={isWebSocketRequest ? readOnlyWebsocketPairs : readOnlyHttpPairs}
    />
  );
};
