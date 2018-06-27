import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import Button from './base/button';
import CodeEditor from './codemirror/code-editor';
import MarkdownPreview from './markdown-preview';

@autobind
class MarkdownEditor extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      markdown: props.defaultValue
    };
  }

  _handleChange(markdown) {
    this.props.onChange(markdown);
    this.setState({ markdown });
  }

  _setEditorRef(n) {
    this._editor = n;
  }

  focusEnd() {
    this._editor && this._editor.focusEnd();
  }

  focus() {
    this._editor && this._editor.focus();
  }

  render() {
    const {
      fontSize,
      lineWrapping,
      indentSize,
      keyMap,
      mode,
      placeholder,
      defaultPreviewMode,
      className,
      tall,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode
    } = this.props;

    const { markdown } = this.state;

    const classes = classnames(
      'react-tabs',
      'markdown-editor',
      'outlined',
      className,
      { 'markdown-editor--dynamic-height': !tall }
    );

    return (
      <Tabs className={classes} defaultIndex={defaultPreviewMode ? 1 : 0}>
        <TabList>
          <Tab>
            <Button value="Write">Write</Button>
          </Tab>
          <Tab>
            <Button value="Preview">Preview</Button>
          </Tab>
        </TabList>
        <TabPanel className="react-tabs__tab-panel markdown-editor__edit">
          <div className="form-control form-control--outlined">
            <CodeEditor
              ref={this._setEditorRef}
              hideGutters
              hideLineNumbers
              dynamicHeight={!tall}
              manualPrettify
              noStyleActiveLine
              mode={mode || 'text/x-markdown'}
              placeholder={placeholder}
              debounceMillis={300}
              keyMap={keyMap}
              fontSize={fontSize}
              lineWrapping={lineWrapping}
              indentSize={indentSize}
              defaultValue={markdown}
              render={handleRender}
              getRenderContext={handleGetRenderContext}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              onChange={this._handleChange}
            />
          </div>
          <div className="txt-sm italic faint">
            Styling with Markdown is supported
          </div>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel markdown-editor__preview">
          <MarkdownPreview markdown={markdown} handleRender={handleRender} />
        </TabPanel>
      </Tabs>
    );
  }
}

MarkdownEditor.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  defaultValue: PropTypes.string.isRequired,
  fontSize: PropTypes.number.isRequired,
  indentSize: PropTypes.number.isRequired,
  keyMap: PropTypes.string.isRequired,
  lineWrapping: PropTypes.bool.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,

  // Optional
  placeholder: PropTypes.string,
  defaultPreviewMode: PropTypes.bool,
  className: PropTypes.string,
  mode: PropTypes.string,
  tall: PropTypes.bool
};

export default MarkdownEditor;
