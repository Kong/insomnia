import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../../key-value-editor/editor';
import {trackEvent} from '../../../../analytics/index';

@autobind
class UrlEncodedEditor extends PureComponent {
  _handleTrackToggle (pair) {
    trackEvent(
      'Url Encoded Editor',
      'Toggle',
      pair.disabled ? 'Disable' : 'Enable'
    );
  }

  _handleTrackCreate () {
    trackEvent('Url Encoded Editor', 'Create');
  }

  _handleTrackDelete () {
    trackEvent('Url Encoded Editor', 'Delete');
  }

  render () {
    const {
      parameters,
      onChange,
      handleRender,
      handleGetRenderContext
    } = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <KeyValueEditor
            sortable
            allowMultiline
            namePlaceholder="name"
            valuePlaceholder="value"
            onChange={onChange}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            onToggleDisable={this._handleTrackToggle}
            onCreate={this._handleTrackCreate}
            onDelete={this._handleTrackDelete}
            pairs={parameters}
          />
        </div>
      </div>
    );
  }
}

UrlEncodedEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  parameters: PropTypes.arrayOf(PropTypes.object).isRequired,

  // Optional
  handleRender: PropTypes.func,
  handleGetRenderContext: PropTypes.func
};

export default UrlEncodedEditor;
