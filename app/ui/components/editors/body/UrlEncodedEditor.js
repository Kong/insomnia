import React, {PropTypes, PureComponent} from 'react';
import Lazy from '../../base/Lazy';
import KeyValueEditor from '../../keyvalueeditor/Editor';
import {trackEvent} from '../../../../analytics/index';

class UrlEncodedEditor extends PureComponent {
  _handleTrackToggle = pair => trackEvent(
    'Url Encoded Editor',
    'Toggle',
    pair.disabled ? 'Disable' : 'Enable'
  );

  _handleTrackCreate = () => trackEvent('Url Encoded Editor', 'Create');
  _handleTrackDelete = () => trackEvent('Url Encoded Editor', 'Delete');

  render () {
    const {parameters, onChange, handleRender} = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <Lazy>
            <KeyValueEditor
              sortable
              namePlaceholder="name"
              valuePlaceholder="value"
              onChange={onChange}
              handleRender={handleRender}
              onToggleDisable={this._handleTrackToggle}
              onCreate={this._handleTrackCreate}
              onDelete={this._handleTrackDelete}
              pairs={parameters}
            />
          </Lazy>
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
