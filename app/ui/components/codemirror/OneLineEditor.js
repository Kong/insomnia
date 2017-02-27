import React, {Component, PropTypes} from 'react';
import Editor from './Editor';

class OneLineEditor extends Component {
  constructor (props) {
    super(props);
    this.value = props.defaultValue;
  }

  focus () {
    this.editor.focusEnd();
  }

  _handleChange = value => {
    this.value = value;
    this.props.onChange && this.props.onChange(value);
  };

  _setRef = n => this.editor = n;

  render () {
    const {defaultValue, ...props} = this.props;
    return (
      <Editor
        ref={this._setRef}
        {...props}
        onChange={this._handleChange}
        className="editor--single-line"
        value={defaultValue}
        defaultTabBehavior={true}
        hideLineNumbers={true}
        hideScrollbars={true}
        noMatchBrackets={true}
        lineWrapping={false}
        singleLine={true}
      />
    )
  }
}

OneLineEditor.propTypes = Object.assign({}, Editor.propTypes, {
  defaultValue: PropTypes.string.isRequired,
});

export default OneLineEditor;
