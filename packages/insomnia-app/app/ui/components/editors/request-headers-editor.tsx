import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { _getCommonHeaderNames, _getCommonHeaderValues } from '../../../common/common-headers';
import { AUTOBIND_CFG } from '../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import type { Request, RequestHeader } from '../../../models/request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  onChange: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  bulk: boolean;
  isVariableUncovered: boolean;
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
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
      handleRender,
      handleGetRenderContext,
      isVariableUncovered,
    } = this.props;
    return bulk ? (
      <div className="tall">
        <CodeEditor
          getRenderContext={handleGetRenderContext}
          render={handleRender}
          isVariableUncovered={isVariableUncovered}
          onChange={this._handleBulkUpdate}
          defaultValue={this._getHeadersString()}
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
            isVariableUncovered={isVariableUncovered}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            handleGetAutocompleteNameConstants={_getCommonHeaderNames}
            handleGetAutocompleteValueConstants={_getCommonHeaderValues}
            onChange={this._handleKeyValueUpdate}
          />
        </div>
      </div>
    );
  }
}
