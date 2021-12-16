import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { AUTOBIND_CFG } from '../../../common/constants';
import type { Request, RequestHeader } from '../../../models/request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  onChange: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  bulk: boolean;
  request: Request;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class RequestHeadersEditor extends PureComponent<Props> {
  _handleBulkUpdate(headersString: string) {
    const { onChange, request } = this.props;

    const headers = RequestHeadersEditor._getHeadersFromString(headersString);

    onChange(request, headers);
  }

  _handleKeyValueUpdate(headers: RequestHeader[]) {
    const { onChange, request } = this.props;
    onChange(request, headers);
  }

  static _getHeadersFromString(headersString: string) {
    const headers: { name: string; value: string }[] = [];
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

    return headers;
  }

  _getHeadersString() {
    const { headers } = this.props.request;
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
  }

  render() {
    const {
      bulk,
      request,
    } = this.props;
    return bulk ? (
      <div className="tall">
        <CodeEditor
          onChange={this._handleBulkUpdate}
          defaultValue={this._getHeadersString()}
          enableNunjucks
        />
      </div>
    ) : (
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
            onChange={this._handleKeyValueUpdate}
          />
        </div>
      </div>
    );
  }
}
