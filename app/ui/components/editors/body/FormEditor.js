import React, {PropTypes, Component} from 'react';
import KeyValueEditor from '../../base/KeyValueEditor';
import {trackEvent} from '../../../../analytics/index';
import {CONTENT_TYPE_FORM_DATA} from '../../../../common/constants';

class FormEditor extends Component {
  render () {
    const {parameters, onChange} = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <KeyValueEditor
            namePlaceholder="name"
            valuePlaceholder="value"
            onToggleDisable={pair => trackEvent('Form Editor', `Toggle ${pair.type || 'text'}`, pair.disabled ? 'Disable' : 'Enable')}
            onChangeType={type => trackEvent('Form Editor', 'Change Type', type)}
            onChooseFile={() => trackEvent('Form Editor', 'Choose File')}
            onCreate={() => trackEvent('Form Editor', 'Create')}
            onDelete={() => trackEvent('Form Editor', 'Delete')}
            onChange={onChange}
            pairs={parameters}
            multipart={true}
          />
          <div className="faded faint txt-sm italic pad no-pad-bottom">
            Sends as <code>{CONTENT_TYPE_FORM_DATA}</code>
          </div>
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
