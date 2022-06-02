import React, { FC, useCallback } from 'react';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import type { Request, RequestHeader } from '../../../models/request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  onChange: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  bulk: boolean;
  request: Request;
}

export const RequestHeadersEditor: FC<Props> = ({
  onChange,
  request,
  bulk,
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

    onChange(request, headers);
  }, [onChange, request]);

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
    onChange(request, headers);
  }, [onChange, request]);

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
    <div className="pad-bottom scrollable-container">
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
        />
      </div>
    </div>
  );
};
