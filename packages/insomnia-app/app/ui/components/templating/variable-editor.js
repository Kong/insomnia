import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';

@autobind
class VariableEditor extends PureComponent {
  constructor(props) {
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

  componentDidMount() {
    this._update(this.state.value, true);
  }

  _handleChange(e) {
    const name = e.target.value;
    this._update(name);
  }

  _setSelectRef(n) {
    this._select = n;

    // Let it render, then focus the input
    setTimeout(() => {
      this._select && this._select.focus();
    }, 100);
  }

  async _update(value, noCallback = false) {
    const { handleRender } = this.props;

    let preview = '';
    let error = '';

    try {
      preview = await handleRender(value);
    } catch (err) {
      error = err.message;
    }

    const context = await this.props.handleGetRenderContext();
    const variables = context.keys;

    // Hack to skip updating if we unmounted for some reason
    if (this._select) {
      this.setState({ preview, error, variables, value });
    }

    // Call the callback if we need to
    if (!noCallback) {
      this.props.onChange(value);
    }
  }

  render() {
    const { error, value, preview, variables } = this.state;
    const isOther = !variables.find(v => value === `{{ ${v.name} }}`);

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>
            Environment Variable
            <select
              ref={this._setSelectRef}
              value={value}
              onChange={this._handleChange}>
              <option value={`{{ 'my custom template logic' | urlencode }}`}>
                -- Custom --
              </option>
              {variables.map((v, i) => (
                <option key={`${i}::${v.name}`} value={`{{ ${v.name} }}`}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isOther && (
          <div className="form-control form-control--outlined">
            <input
              type="text"
              defaultValue={value}
              onChange={this._handleChange}
            />
          </div>
        )}
        <div className="form-control form-control--outlined">
          <label>
            Live Preview
            {error ? (
              <textarea className="danger" value={error || 'Error'} readOnly />
            ) : (
              <textarea value={preview || ''} readOnly />
            )}
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
