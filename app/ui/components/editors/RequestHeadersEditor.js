import React, {Component, PropTypes} from 'react';

import KeyValueEditor from '../keyvalueeditor/Editor';
import Editor from '../codemirror/Editor';
import {trackEvent} from '../../../analytics/index';

class RequestHeadersEditor extends Component {
  _handleBulkUpdate = headersString => {
    this.props.onChange(this._getHeadersFromString(headersString));
  };

  _handleTrackToggle = pair => trackEvent('Headers Editor', 'Toggle', pair.disabled ? 'Disable' : 'Enable');
  _handleTrackCreate = () => trackEvent('Headers Editor', 'Create');
  _handleTrackDelete = () => trackEvent('Headers Editor', 'Delete');

  _getHeadersFromString (headersString) {
    const headers = [];
    const rows = headersString.split(/[\n,]+/);

    for (const row of rows) {
      const items = row.split(':');

      if (items.length != 2) {
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

  render () {
    const {bulk, headers, onChange, handleRender} = this.props;

    return bulk ? (
      <div className="tall">
        <Editor
          onChange={this._handleBulkUpdate}
          value={this._getHeadersString()}
        />
      </div>
    ) : (
      <div className="pad-bottom scrollable-container">
        <div className="scrollable">
          <KeyValueEditor
            namePlaceholder="My-Header"
            valuePlaceholder="Value"
            pairs={headers}
            sortable={true}
            handleRender={handleRender}
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
  headers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired
  })).isRequired
};

export default RequestHeadersEditor;
