// @flow

import * as React from 'react';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../key-value-editor/editor';
import CodeEditor from '../codemirror/code-editor';
import allHeaderNames from '../../../datasets/header-names';
import allCharsets from '../../../datasets/charsets';
import allMimeTypes from '../../../datasets/content-types';
import allEncodings from '../../../datasets/encodings';
import type { Request, RequestHeader } from '../../../models/request';

type Props = {
  onChange: (r: Request, headers: Array<RequestHeader>) => Promise<Request>,
  bulk: boolean,
  editorFontSize: number,
  editorIndentSize: number,
  editorLineWrapping: boolean,
  nunjucksPowerUserMode: boolean,
  isVariableUncovered: boolean,
  handleRender: Function,
  handleGetRenderContext: Function,
  request: Request,
};

@autobind
class RequestHeadersEditor extends React.PureComponent<Props> {
  _handleBulkUpdate(headersString: string) {
    const { onChange, request } = this.props;
    const headers = RequestHeadersEditor._getHeadersFromString(headersString);

    onChange(request, headers);
  }

  _handleKeyValueUpdate(headers: Array<RequestHeader>) {
    const { onChange, request } = this.props;
    onChange(request, headers);
  }

  static _getHeadersFromString(headersString: string) {
    const headers = [];
    const rows = headersString.split(/\n+/);

    for (const row of rows) {
      const [rawName, rawValue] = row.split(/:(.*)$/);

      const name = (rawName || '').trim();
      const value = (rawValue || '').trim();

      if (!name && !value) {
        continue;
      }

      headers.push({ name, value });
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

  static _getCommonHeaderValues(pair: RequestHeader) {
    switch (pair.name.toLowerCase()) {
      case 'content-type':
      case 'accept':
        return allMimeTypes;
      case 'accept-charset':
        return allCharsets;
      case 'accept-encoding':
        return allEncodings;
      default:
        return [];
    }
  }

  static _getCommonHeaderNames(pair: RequestHeader) {
    return allHeaderNames;
  }

  render() {
    const {
      bulk,
      request,
      editorFontSize,
      editorIndentSize,
      editorLineWrapping,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
    } = this.props;

    return bulk ? (
      <div className="tall">
        <CodeEditor
          getRenderContext={handleGetRenderContext}
          render={handleRender}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
          fontSize={editorFontSize}
          indentSize={editorIndentSize}
          lineWrapping={editorLineWrapping}
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
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            handleGetAutocompleteNameConstants={RequestHeadersEditor._getCommonHeaderNames}
            handleGetAutocompleteValueConstants={RequestHeadersEditor._getCommonHeaderValues}
            onChange={this._handleKeyValueUpdate}
          />
        </div>
      </div>
    );
  }
}

export default RequestHeadersEditor;
