import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../codemirror/one-line-editor';

class Tag {
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
    return new Tag(newTemplate);
  }

  _extractValues (template) {
    const m1 = template.match(/^{%\s*/);
    const m2 = template.match(/\s*%}$/);

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
class TagEditor extends PureComponent {
  constructor (props) {
    super(props);

    const tag = new Tag(props.defaultValue);

    this.state = {
      tag,
      value: '',
      error: ''
    };
  }

  componentWillMount () {
    this._update(this.state.tag.getName());
  }

  _setInputRef (n) {
    this._input = n;

    // Unmounting
    if (!this._input) {
      return;
    }

    setTimeout(() => {
      this._input.focusEnd();
    }, 100);
  }

  async _update (tagName) {
    const {handleRender} = this.props;

    let value = '';
    let error = '';

    const tag = this.state.tag.cloneWithNewName(tagName);

    try {
      value = await handleRender(tag.getTemplate(), true);
    } catch (err) {
      error = err.message;
    }

    this.setState({tag, value, error});
    this.props.onChange(tag.getTemplate());
  }

  render () {
    const {tag, error, value} = this.state;

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>Tag Name
            <OneLineEditor
              forceEditor
              ref={this._setInputRef}
              onChange={this._update}
              defaultValue={tag.getName()}
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

TagEditor.propTypes = {
  handleRender: PropTypes.func.isRequired,
  defaultValue: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};

export default TagEditor;
