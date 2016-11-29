import React, {PropTypes, Component} from 'react';
import KeyValueEditor from '../../base/KeyValueEditor';
import {trackEvent} from '../../../../analytics/index';

class FormEditor extends Component {
  _handleTrackToggle = pair => {
    trackEvent(
      'Form Editor',
      `Toggle ${pair.type || 'text'}`,
      pair.disabled ? 'Disable' : 'Enable'
    );
  };

  _handleTrackChangeType = type => trackEvent('Form Editor', 'Change Type', type);
  _handleTrackChooseFile = () => trackEvent('Form Editor', 'Choose File');
  _handleTrackCreate = () => trackEvent('Form Editor', 'Create');
  _handleTrackDelete = () => trackEvent('Form Editor', 'Delete');

  render () {
    const {parameters, onChange} = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <KeyValueEditor
            namePlaceholder="name"
            valuePlaceholder="value"
            onToggleDisable={this._handleTrackToggle}
            onChangeType={this._handleTrackChangeType}
            onChooseFile={this._handleTrackChooseFile}
            onCreate={this._handleTrackCreate}
            onDelete={this._handleTrackDelete}
            onChange={onChange}
            pairs={parameters}
            multipart={true}
          />
        </div>
      </div>
    )
  }
}

FormEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  parameters: PropTypes.arrayOf(PropTypes.object).isRequired
};

export default FormEditor;
