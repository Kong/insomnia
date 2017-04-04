import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Input from '../codemirror/one-line-editor';

const TAGS = [
  {name: `uuid 'v4'`},
  {name: `uuid 'v1'`},
  {name: `now 'ISO-8601'`},
  {name: `now 'unix'`},
  {name: `now 'millis'`}
  // 'response'
];

@autobind
class TagEditor extends PureComponent {
  constructor (props) {
    super(props);

    const inner = props.defaultValue
      .replace(/\s*%}$/, '')
      .replace(/^{%\s*/, '');

    this.state = {
      tags: TAGS,
      value: `{% ${inner} %}`,
      preview: '',
      error: ''
    };
  }

  componentWillMount () {
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

    // Hack to skip updating if we unmounted for some reason
    if (this._select) {
      this.setState({preview, error, value});
    }

    // Call the callback if we need to
    if (!noCallback) {
      this.props.onChange(value);
    }
  }

  render () {
    const {error, value, preview, tags} = this.state;
    const isOther = !tags.find(v => value === `{% ${v.name} %}`);

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>Template Function
            <select ref={this._setSelectRef} onChange={this._handleChange} value={value}>
              {isOther ? (
                <option value={`{% uuid 'v4' %}`}>
                  -- Custom --
                </option>
              ) : null}
              {tags.map((t, i) => (
                <option key={`${i}::${t.name}`} value={`{% ${t.name} %}`}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isOther ? (
          <div className="form-control form-control--outlined">
            <Input
              forceEditor
              mode="nunjucks"
              type="text"
              defaultValue={value}
              onChange={this._update}
            />
          </div>
        ) : null}
        <div className="form-control form-control--outlined">
          <label>Live Preview
            {error
              ? <code className="block danger selectable">{error || <span>&nbsp;</span>}</code>
              : <code className="block selectable">{preview || <span>&nbsp;</span>}</code>
            }
          </label>
        </div>
      </div>
    );
  }
}

TagEditor.propTypes = {
  handleRender: PropTypes.func.isRequired,
  defaultValue: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};

export default TagEditor;
