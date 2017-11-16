// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../key-value-editor/editor';
import CodeEditor from '../codemirror/code-editor';
import {trackEvent} from '../../../analytics/index';
import allHeaderNames from '../../../datasets/header-names';
import allCharsets from '../../../datasets/charsets';
import allMimeTypes from '../../../datasets/content-types';
import allEncodings from '../../../datasets/encodings';
import type {RequestHeader} from '../../../models/request';

type Props = {
  onChange: Function,
  bulk: boolean,
  editorFontSize: number,
  editorIndentSize: number,
  editorLineWrapping: boolean,
  nunjucksPowerUserMode: boolean,
  handleRender: Function,
  handleGetRenderContext: Function,
  headers: Array<RequestHeader>,
  inheritedHeaders: Array<RequestHeader> | null
};

@autobind
class RequestHeadersEditor extends React.PureComponent<Props> {
  _handleBulkUpdate (headersString: string) {
    this.props.onChange(this._getHeadersFromString(headersString));
  }

  _generateHeadersKey (parameters: Array<RequestHeader>) {
    const keyParts = [];
    for (const parameter of parameters) {
      const segments = [
        parameter.name,
        parameter.value || '',
        parameter.disabled ? 'disabled' : 'enabled'
      ];
      keyParts.push(segments.join(':::'));
    }

    return keyParts.join('_++_');
  }

  _handleTrackToggle (pair: RequestHeader) {
    trackEvent('Headers Editor', 'Toggle', pair.disabled ? 'Disable' : 'Enable');
  }

  _handleTrackCreate () {
    trackEvent('Headers Editor', 'Create');
  }

  _handleTrackDelete () {
    trackEvent('Headers Editor', 'Delete');
  }

  _getHeadersFromString (headersString: string): Array<RequestHeader> {
    const headers = [];
    const rows = headersString.split(/\n+/);

    for (const row of rows) {
      const [rawName, rawValue] = row.split(/:(.*)$/);

      const name = (rawName || '').trim();
      const value = (rawValue || '').trim();

      if (!name && !value) {
        continue;
      }

      headers.push({name, value});
    }

    return headers;
  }

  _getHeadersString () {
    const {headers} = this.props;

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

  _getCommonHeaderValues (pair: RequestHeader) {
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

  _getCommonHeaderNames (pair: RequestHeader) {
    return allHeaderNames;
  }

  render () {
    const {
      bulk,
      headers,
      inheritedHeaders,
      editorFontSize,
      editorIndentSize,
      editorLineWrapping,
      onChange,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode
    } = this.props;

    return bulk ? (
      <div className="tall">
        <CodeEditor
          getRenderContext={handleGetRenderContext}
          render={handleRender}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
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
          <div className="pad-top">
            {inheritedHeaders ? (
              <div>
                <div className="label--small pad-left">
                  Inherited Headers
                </div>

                <KeyValueEditor
                  key={this._generateHeadersKey(inheritedHeaders)}
                  sortable
                  disabled
                  readOnly
                  namePlaceholder="My-Header"
                  valuePlaceholder="Value"
                  pairs={inheritedHeaders}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                />
              </div>
            ) : null}

            {inheritedHeaders ? (
              <div className="label--small pad-left pad-top">
                Headers
              </div>
            ) : null}

            <KeyValueEditor
              sortable
              namePlaceholder="My-Header"
              valuePlaceholder="Value"
              className="no-pad"
              pairs={headers}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
              handleGetAutocompleteNameConstants={this._getCommonHeaderNames}
              handleGetAutocompleteValueConstants={this._getCommonHeaderValues}
              onToggleDisable={this._handleTrackToggle}
              onCreate={this._handleTrackCreate}
              onDelete={this._handleTrackDelete}
              onChange={onChange}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default RequestHeadersEditor;
