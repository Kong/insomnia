import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';

@autobind
class VariableEditor extends PureComponent {
  constructor (props) {
    super(props);

    const inner = props.defaultValue
      .replace(/\s*}}$/, '')
      .replace(/^{{\s*/, '');

    this.state = {
      variables: [],
      value: `{{ ${inner} }}`,
      preview: '',
      error: ''
    };
  }

  componentDidMount () {
    this._update(this.state.value, true);
  }

  _handleChange (e) {
    this._update(e.target.value);
  }

  _setSelectRef (n) {
    this._select = n;

    // Let it render, then focus the input
    setTimeout(() => {
      this._select && this._select.focus();
    }, 100);
  }

  async _update (value, noCallback = false) {
    const {handleRender} = this.props;

    let preview = '';
    let error = '';

    try {
      preview = await handleRender(value, true);
    } catch (err) {
      error = err.message;
    }

    const variables = await this._autocompleteVariables();

    // Hack to skip updating if we unmounted for some reason
    if (this._select) {
      this.setState({preview, error, variables, value});
    }

    // Call the callback if we need to
    if (!noCallback) {
      this.props.onChange(value);
    }
  }

  async _autocompleteVariables () {
    const context = await this.props.handleGetRenderContext();
    return context.keys;
  }

  render () {
    const {error, value, preview, variables} = this.state;

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>Environment Variable
            <select ref={this._setSelectRef} value={value} onChange={this._handleChange}>
              {variables.map((v, i) => (
                <option key={`${i}::${v.name}`} value={`{{ ${v.name} }}`}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-control form-control--outlined">
          <label>Live Preview
            {error
              ? <code className="block danger selectable">{error}</code>
              : <code className="block selectable">{preview}</code>
            }
          </label>
        </div>
      </div>
    );
  }
}

VariableEditor.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  defaultValue: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};

export default VariableEditor;
