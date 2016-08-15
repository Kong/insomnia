import React, {PropTypes, Component} from 'react';
import Editor from '../base/Editor';

class EnvironmentEditor extends Component {
  getValue () {
    return JSON.parse(this._editor.getValue());
  }

  isValid () {
    try {
      return this.getValue() !== undefined;
    } catch (e) {
      // Failed to parse JSON
      return false;
    }
  }

  _handleChange () {
    this.props.didChange();
  }

  render () {
    const {environment, ...props} = this.props;

    return (
      <Editor
        ref={n => this._editor = n}
        onChange={this._handleChange.bind(this)}
        value={JSON.stringify(environment)}
        prettify={true}
        mode="application/json"
        {...props}
      />
    )
  }
}

EnvironmentEditor.propTypes = {
  environment: PropTypes.object.isRequired,
  didChange: PropTypes.func.isRequired
};

export default EnvironmentEditor;
