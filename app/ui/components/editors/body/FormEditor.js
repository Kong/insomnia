import React, {PropTypes, Component} from 'react';
import KeyValueEditor from '../../base/KeyValueEditor';

class FormEditor extends Component {
  render () {
    const {parameters, onChange} = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <KeyValueEditor onChange={onChange} pairs={parameters} valueInputType="file"/>
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
