import type { RequestHeader } from 'insomnia-data';
import React, { type FC, useCallback } from 'react';
import { useParams } from 'react-router';

import { getAppVersion } from '~/common/constants';
import { invariant } from '~/common/utils/invariant';
import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { generateId } from '../../../common/misc';
import { useRequestGroupPatcher, useRequestPatcher } from '../../hooks/use-request';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  headers: RequestHeader[];
  bulk: boolean;
  isDisabled?: boolean;
  requestType: 'Request' | 'RequestGroup' | 'WebSocketRequest' | 'McpRequest';
  disableUserAgentHeader?: boolean;
  onDescriptionToggle?: () => void;
}
export const readOnlyWebsocketPairs = [
  { name: 'Connection', value: 'Upgrade', canDisable: false },
  { name: 'Upgrade', value: 'websocket', canDisable: false },
  { name: 'Sec-WebSocket-Key', value: '<calculated at runtime>', canDisable: false },
  { name: 'Sec-WebSocket-Version', value: '13', canDisable: false },
  { name: 'Sec-WebSocket-Extensions', value: 'permessage-deflate; client_max_window_bits', canDisable: false },
  { name: 'User-Agent', value: 'insomnia/' + getAppVersion(), canDisable: true },
].map(pair => ({ ...pair, id: generateId('pair') }));
export const readOnlyHttpPairs = [
  { name: 'Accept', value: '*/*', canDisable: false },
  { name: 'Host', value: '<calculated at runtime>', canDisable: false },
  { name: 'User-Agent', value: 'insomnia/' + getAppVersion(), canDisable: true },
].map(pair => ({ ...pair, id: generateId('pair') }));

export const RequestHeadersEditor: FC<Props> = ({
  headers,
  bulk,
  isDisabled,
  requestType,
  disableUserAgentHeader,
  onDescriptionToggle,
}) => {
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const isRequestGroup = requestType === 'RequestGroup';
  const patcher = isRequestGroup ? patchRequestGroup : patchRequest;
  const isWebSocketRequest = requestType === 'WebSocketRequest';
  const { requestId, requestGroupId } = useParams() as { requestId?: string; requestGroupId?: string };
  const id = isRequestGroup ? requestGroupId : requestId;
  invariant(id, 'Request or RequestGroup ID is required');
  const showUserAgentReadOnly = !isRequestGroup && !headers.some(h => h.name.toLowerCase() === 'user-agent');
  const readOnlyPairs = (isWebSocketRequest ? readOnlyWebsocketPairs : readOnlyHttpPairs).filter(
    p => showUserAgentReadOnly || p.name.toLowerCase() !== 'user-agent',
  );
  const patchHeaders = useCallback(
    (newHeaders: RequestHeader[]) => {
      const hadUserAgent = headers.some(h => h.name.toLowerCase() === 'user-agent');
      const hasUserAgent = newHeaders.some(h => h.name.toLowerCase() === 'user-agent');
      // If the user just removed their last User-Agent header, default the read-only row to
      // disabled rather than letting it silently start sending `insomnia/<version>`.
      if (!isRequestGroup && hadUserAgent && !hasUserAgent) {
        patchRequest(id, { headers: newHeaders, disableUserAgentHeader: true });
      } else {
        patcher(id, { headers: newHeaders });
      }
    },
    [headers, id, isRequestGroup, patcher, patchRequest],
  );
  const handleBulkUpdate = useCallback(
    (headersString: string) => {
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
      patchHeaders(headersArray);
    },
    [patchHeaders],
  );

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
      onChange={patchHeaders}
      isDisabled={isDisabled}
      readOnlyPairs={readOnlyPairs}
      readOnlyDisabledByName={showUserAgentReadOnly ? { 'user-agent': !!disableUserAgentHeader } : undefined}
      onReadOnlyDisabledChange={
        showUserAgentReadOnly ? (_name, disabled) => patchRequest(id, { disableUserAgentHeader: disabled }) : undefined
      }
      onDescriptionToggle={onDescriptionToggle}
    />
  );
};
