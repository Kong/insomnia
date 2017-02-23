import React, {Component, PropTypes} from 'react';
import Editor from './Editor';

class OneLineEditor extends Component {
  render () {
    const {defaultValue, ...props} = this.props;
    return (
      <Editor
        {...props}
        className="editor--single-line"
        hideLineNumbers={true}
        value={defaultValue}
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
