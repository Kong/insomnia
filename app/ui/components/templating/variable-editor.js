import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../codemirror/one-line-editor';

class Variable {
  constructor (template) {
    const {name, post, pre} = this._extractValues(template);
    this._name = name;
    this._post = post;
    this._pre = pre;
  }

  getTemplate () {
    return `${this._pre}${this._name}${this._post}`;
  }

  getName () {
    return this._name;
  }

  cloneWithNewName (name) {
    const newTemplate = `${this._pre}${name}${this._post}`;
    return new Variable(newTemplate);
  }

  _extractValues (template) {
    const m1 = template.match(/^{{\s*/);
    const m2 = template.match(/\s*}}$/);

    const pre = m1[0];
    const post = m2[0];

    // Slice in between start and end
    const name = template.slice(
      m1.index + m1[0].length,
      m2.index
    );

    return {name, pre, post};
  }
}

@autobind
class VariableEditor extends PureComponent {
  constructor (props) {
    super(props);

    const variable = new Variable(props.defaultValue);

    this.state = {
      variable,
      value: '',
      error: ''
    };
  }

  componentWillMount () {
    this._update(this.state.variable.getName(), true);
  }

  _setInputRef (n) {
    this._input = n;

    // Let it render, then focus the input
    setTimeout(() => {
      this._input && this._input.focusEnd();
    }, 100);
  }

  async _update (variableName, noCallback = false) {
    const {handleRender} = this.props;

    let value = '';
    let error = '';

    const variable = this.state.variable.cloneWithNewName(variableName);

    try {
      value = await handleRender(variable.getTemplate(), true);
    } catch (err) {
      error = err.message;
    }

    // Hack to skip updating if we unmounted for some reason
    if (this._input) {
      this.setState({variable, value, error});
    }

    // Call the callback if we need to
    if (!noCallback) {
      this.props.onChange(variable.getTemplate());
    }
  }

  render () {
    const {variable, error, value} = this.state;

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>Variable Name
            <OneLineEditor
              ref={this._setInputRef}
              forceEditor
              onChange={this._update}
              defaultValue={variable.getName()}
            />
          </label>
        </div>
        <div className="form-control form-control--outlined">
          <label>Live Preview
            {error
              ? <code className="block danger selectable">{error}</code>
              : <code className="block selectable">{value}</code>
            }
          </label>
        </div>
      </div>
    );
  }
}

VariableEditor.propTypes = {
  handleRender: PropTypes.func.isRequired,
  defaultValue: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};

export default VariableEditor;
