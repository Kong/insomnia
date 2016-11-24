import React, {PropTypes, Component} from 'react';
import KeyValueEditor from '../../base/KeyValueEditor';
import {trackEvent} from '../../../../analytics/index';
import {CONTENT_TYPE_FORM_URLENCODED} from '../../../../common/constants';

class UrlEncodedEditor extends Component {
  render () {
    const {parameters, onChange} = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <KeyValueEditor
            namePlaceholder="name"
            valuePlaceholder="value"
            onChange={onChange}
            onToggleDisable={pair => trackEvent('Url Encoded Editor', 'Toggle', pair.disabled ? 'Disable' : 'Enable')}
            onCreate={() => trackEvent('Url Encoded Editor', 'Create')}
            onDelete={() => trackEvent('Url Encoded Editor', 'Delete')}
            pairs={parameters}
          />
          <div className="faded faint txt-sm italic pad no-pad-bottom">
            Sends as <code>{CONTENT_TYPE_FORM_URLENCODED}</code>
          </div>
        </div>
      </div>
    )
  }
}

UrlEncodedEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  parameters: PropTypes.arrayOf(PropTypes.object).isRequired
};

export default UrlEncodedEditor;
