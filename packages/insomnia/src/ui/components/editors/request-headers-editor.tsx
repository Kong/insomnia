import React, { FC } from 'react';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import type { Request, RequestHeader } from '../../../models/request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  onChange: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  bulk: boolean;
  request: Request;
}

export const RequestHeadersEditor: FC<Props> = props => {
  const _handleBulkUpdate = (headersString: string) => {
    const {
      onChange,
      request,
    } = props;
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
  };

  const _getHeadersString = () => {
    const {
      headers,
    } = props.request;
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

    return headersString;
  };

  const {
    bulk,
    request,
  } = props;
  return bulk ? <div className="tall">
    <CodeEditor onChange={_handleBulkUpdate} defaultValue={_getHeadersString()} enableNunjucks />
  </div> : <div className="pad-bottom scrollable-container">
    <div className="scrollable">
      <KeyValueEditor sortable namePlaceholder="header" valuePlaceholder="value" descriptionPlaceholder="description" pairs={request.headers} handleGetAutocompleteNameConstants={getCommonHeaderNames} handleGetAutocompleteValueConstants={getCommonHeaderValues} onChange={headers => props.onChange(props.request, headers)} />
    </div>
  </div>;
};
