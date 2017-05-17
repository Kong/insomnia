import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Input from '../codemirror/one-line-editor';

const TAGS = [
  {name: `uuid 'v4'`},
  {name: `uuid 'v1'`},
  {name: `now 'ISO-8601'`},
  {name: `now 'unix'`},
  {name: `now 'millis'`},
  {name: `base64 'encode'`, suffix: `, 'my string'`},
  {name: `base64 'decode'`, suffix: `, 'bXkgc3RyaW5n'`}
  // 'response'
];

const CUSTOM_TAG_VALUE = `{% custom 'tag' %}`;

@autobind
class TagEditor extends PureComponent {
  constructor (props) {
    super(props);

    const inner = props.defaultValue
      .replace(/\s*%}$/, '')
      .replace(/^{%\s*/, '');

    const value = `{% ${inner} %}`;
    this.state = {
      tags: TAGS,
      value: value,
      selectValue: value,
      preview: '',
      error: ''
    };
  }

  componentWillMount () {
    this._update(this.state.value, true);
  }

  _handleChange (e) {
    this._update(e.target.value, false, e.target.value);
  }

  _setSelectRef (n) {
    this._select = n;

    // Let it render, then focus the input
    setTimeout(() => {
      this._select && this._select.focus();
    }, 100);
  }

  async _update (value, noCallback = false, selectValue = null) {
    const {handleRender} = this.props;

    let preview = '';
    let error = '';

    try {
      preview = await handleRender(value, true);
    } catch (err) {
      error = err.message;
    }

    const isMounted = !!this._select;
    if (isMounted) {
      this.setState({
        preview,
        error,
        value,
        selectValue: selectValue || this.state.selectValue
      });
    }

    // Call the callback if we need to
    if (!noCallback) {
      this.props.onChange(value);
    }
  }

  render () {
    const {error, value, preview, tags, selectValue} = this.state;
    const isFound = !!tags.find(v => value === `{% ${v.name} %}`);
    const isFlexible = value.indexOf('{% base64') === 0;
    const isCustom = !isFound && !isFlexible;

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>Template Function
            <select ref={this._setSelectRef}
                    onChange={this._handleChange}
                    value={isCustom ? CUSTOM_TAG_VALUE : selectValue}>
              {tags.map((t, i) => (
                <option key={`${i}::${t.name}`} value={`{% ${t.name}${t.suffix || ''} %}`}>
                  {t.name}
                </option>
              ))}
              <option value={`{% custom 'tag' %}`}>
                -- Custom --
              </option>
            </select>
          </label>
        </div>
        {(!isFound || isFlexible) ? (
          <div className="form-control form-control--outlined">
            <Input
              key={selectValue}
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
