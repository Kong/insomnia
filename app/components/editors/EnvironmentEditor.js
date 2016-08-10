import React, {PropTypes, Component} from 'react';
import Editor from '../base/Editor';

class EnvironmentEditor extends Component {

  constructor (props) {
    super(props);

    this.state = {
      environmentJSON: JSON.stringify(props.environment)
    }
  }

  getValue () {
    return JSON.parse(this.state.environmentJSON);
  }

  isValid () {
    try {
      return this.getValue() !== undefined;
    } catch (e) {
      // Failed to parse JSON
      return false;
    }
  }

  _handleChange (environmentJSON) {
    this.setState({environmentJSON});
    this.props.didChange();
  }

  render () {
    const {environment, ...props} = this.props;
    const {environmentJSON} = this.state;

    return (
      <Editor
        onChange={this._handleChange.bind(this)}
        value={environmentJSON}
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
