import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../key-value-editor/editor';
import CodeEditor from '../codemirror/code-editor';
import allHeaderNames from '../../../datasets/header-names';
import allCharsets from '../../../datasets/charsets';
import allMimeTypes from '../../../datasets/content-types';
import allEncodings from '../../../datasets/encodings';

@autobind
class RequestHeadersEditor extends PureComponent {
  _handleBulkUpdate(headersString) {
    this.props.onChange(this._getHeadersFromString(headersString));
  }

  _getHeadersFromString(headersString) {
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
    const { headers } = this.props;

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

  _getCommonHeaderValues(pair) {
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

  _getCommonHeaderNames(pair) {
    return allHeaderNames;
  }

  render() {
    const {
      bulk,
      headers,
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
          <KeyValueEditor
            sortable
            namePlaceholder="Header"
            valuePlaceholder="Value"
            pairs={headers}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            handleGetAutocompleteNameConstants={this._getCommonHeaderNames}
            handleGetAutocompleteValueConstants={this._getCommonHeaderValues}
            onChange={onChange}
          />
        </div>
      </div>
    );
  }
}

RequestHeadersEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  bulk: PropTypes.bool.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorIndentSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  headers: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired
    })
  ).isRequired
};

export default RequestHeadersEditor;
