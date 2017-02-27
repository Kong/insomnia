import React, {PropTypes, Component} from 'react';
import KeyValueEditor from '../../base/KeyValueEditor';
import {trackEvent} from '../../../../analytics/index';

class UrlEncodedEditor extends Component {
  _handleTrackToggle = pair => {
    trackEvent('Url Encoded Editor', 'Toggle', pair.disabled ? 'Disable' : 'Enable')
  };
  _handleTrackCreate = () => trackEvent('Url Encoded Editor', 'Create');
  _handleTrackDelete = () => trackEvent('Url Encoded Editor', 'Delete');

  render () {
    const {parameters, onChange, handleRender} = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <KeyValueEditor
            namePlaceholder="name"
            valuePlaceholder="value"
            onChange={onChange}
            handleRender={handleRender}
            onToggleDisable={this._handleTrackToggle}
            onCreate={this._handleTrackCreate}
            onDelete={this._handleTrackDelete}
            pairs={parameters}
          />
        </div>
      </div>
    )
  }
}

UrlEncodedEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  parameters: PropTypes.arrayOf(PropTypes.object).isRequired,
  handleRender: PropTypes.func.isRequired,
};

export default UrlEncodedEditor;
