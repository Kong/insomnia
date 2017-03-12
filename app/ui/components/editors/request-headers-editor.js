import React, {PureComponent, PropTypes} from 'react';
import mime from 'mime-types';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../key-value-editor/editor';
import Editor from '../codemirror/code-editor';
import {trackEvent} from '../../../analytics/index';

let mimesSet = {};
for (const t of Object.keys(mime.types)) {
  mimesSet[mime.types[t]] = 1;
}
const allMimeTypes = Object.keys(mimesSet);

@autobind
class RequestHeadersEditor extends PureComponent {
  _handleBulkUpdate (headersString) {
    this.props.onChange(this._getHeadersFromString(headersString));
  }

  _handleTrackToggle (pair) {
    trackEvent('Headers Editor', 'Toggle', pair.disabled ? 'Disable' : 'Enable');
  }

  _handleTrackCreate () {
    trackEvent('Headers Editor', 'Create');
  }

  _handleTrackDelete () {
    trackEvent('Headers Editor', 'Delete');
  }

  _getHeadersFromString (headersString) {
    const headers = [];
    const rows = headersString.split(/[\n,]+/);

    for (const row of rows) {
      const items = row.split(':');

      if (items.length !== 2) {
        // Need a colon to be valid
        continue;
      }

      const name = items[0].trim();
      const value = items[1].trim();

      if (!name || !value) {
        // Need name and value to be valid
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

      // Make sure it's a valid header (key + value)
      if (!header.name || !header.value) {
        continue;
      }

      headersString += `${header.name}: ${header.value}\n`;
    }

    return headersString;
  }

  _getCommonHeaderValues (pair) {
    if (pair.name.toLowerCase() === 'content-type') {
      return allMimeTypes;
    }
  }

  _getCommonHeaderNames (pair) {
    return [
      'Accept',
      'Accept-Charset',
      'Accept-Encoding',
      'Accept-Language',
      'Accept-Datetime',
      'Authorization',
      'Cache-Control',
      'Connection',
      'Cookie',
      'Content-Length',
      'Content-MD5',
      'Content-Type',
      'Date',
      'Expect',
      'Forwarded',
      'From',
      'Host',
      'If-Match',
      'If-Modified-Since',
      'If-None-Match',
      'If-Range',
      'If-Unmodified-Since',
      'Max-Forwards',
      'Origin',
      'Pragma',
      'Proxy-Authorization',
      'Range',
      'Referer',
      'TE',
      'User-Agent',
      'Upgrade',
      'Via',
      'Warning'
    ];
  }

  render () {
    const {
      bulk,
      headers,
      onChange,
      handleRender,
      handleGetRenderContext
    } = this.props;

    return bulk ? (
        <div className="tall">
          <Editor
            onChange={this._handleBulkUpdate}
            defaultValue={this._getHeadersString()}
          />
        </div>
      ) : (
        <div className="pad-bottom scrollable-container">
          <div className="scrollable">
            <KeyValueEditor
              sortable
              namePlaceholder="My-Header"
              valuePlaceholder="Value"
              pairs={headers}
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
      );
  }
}

RequestHeadersEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  bulk: PropTypes.bool.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  headers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired
  })).isRequired
};

export default RequestHeadersEditor;
