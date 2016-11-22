import React, {PropTypes, Component} from 'react';
import KeyValueEditor from '../../base/KeyValueEditor';

class UrlEncodedEditor extends Component {
  render () {
    const {parameters, onChange} = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <KeyValueEditor onChange={onChange} pairs={parameters}/>
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
