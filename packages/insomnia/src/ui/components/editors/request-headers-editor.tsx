import React, { FC } from 'react';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { updateById } from '../../../models/helpers/request-operations';
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
  const handleBulkUpdate = (headersString: string) => {
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
    updateById(request._id, { headers });
  };

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
      onChange={(headers: RequestHeader[]) => {
        updateById(request._id, { headers });
      }}
      isDisabled={isDisabled}
      isWebSocketRequest={isWebSocketRequest(request)}
    />
  );
};
