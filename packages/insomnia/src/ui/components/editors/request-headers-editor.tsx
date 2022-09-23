import React, { FC, useCallback } from 'react';
import styled from 'styled-components';

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
  noWrap?: boolean;
}

const ScrollableContainer = styled.div<{ noWrap?: boolean }>(({ noWrap }) => ({
  position: noWrap ? 'initial' : 'relative',
}));

export const RequestHeadersEditor: FC<Props> = ({
  request,
  bulk,
  isDisabled,
  noWrap = false,
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

  return (
    <ScrollableContainer
      noWrap={noWrap}
      className="pad-bottom scrollable-container"
    >
      <div className="scrollable">
        <KeyValueEditor
          sortable
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
      </div>
    </ScrollableContainer>
  );
};
