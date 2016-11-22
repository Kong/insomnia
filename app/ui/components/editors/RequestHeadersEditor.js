import React, {Component, PropTypes} from 'react';

import KeyValueEditor from '../base/KeyValueEditor';
import Editor from '../base/Editor';

class RequestHeadersEditor extends Component {
  _handleBulkUpdate (headersString) {
    this.props.onChange(this._getHeadersFromString(headersString));
  }

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
    const {bulk, headers, onChange} = this.props;

    return bulk ? (
      <div className="tall">
        <Editor
          onChange={v => this._handleBulkUpdate(v)}
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
  headers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired
  })).isRequired
};

export default RequestHeadersEditor;
