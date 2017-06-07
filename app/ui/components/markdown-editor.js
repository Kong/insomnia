import React, {PropTypes, PureComponent} from 'react';
import ReactDOM from 'react-dom';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import marked from 'marked';
import highlight from 'highlight.js';
import {Tab, TabList, TabPanel, Tabs} from 'react-tabs';
import {trackEvent} from '../../analytics';
import Button from './base/button';
import CodeEditor from './codemirror/code-editor';
import * as misc from '../../common/misc';

@autobind
class MarkdownEditor extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      markdown: props.defaultValue,
      compiled: '',
      renderError: ''
    };
  }

  _trackTab (name) {
    trackEvent('Request', 'Markdown Editor Tab', name);
  }

  _handleChange (markdown) {
    this.props.onChange(markdown);
    this._compileMarkdown(markdown);
  }

  async _compileMarkdown (markdown) {
    const newState = {markdown};
    try {
      const rendered = await this.props.handleRender(markdown);
      newState.compiled = marked(rendered);
    } catch (err) {
      newState.renderError = err.message;
    }

    this.setState(newState);
  }

  _setPreviewRef (n) {
    this._preview = n;
  }

  _highlightCodeBlocks () {
    if (!this._preview) {
      return;
    }

    const el = ReactDOM.findDOMNode(this._preview);
    for (const block of el.querySelectorAll('pre > code')) {
      highlight.highlightBlock(block);
    }

    for (const a of el.querySelectorAll('a')) {
      a.addEventListener('click', e => {
        e.preventDefault();
        misc.clickLink(e.target.getAttribute('href'));
      });
    }
  }

  componentWillMount () {
    this._compileMarkdown(this.state.markdown);
  }

  componentDidUpdate () {
    this._highlightCodeBlocks();
  }

  componentDidMount () {
    marked.setOptions({
      renderer: new marked.Renderer(),
      gfm: true,
      tables: true,
      breaks: false,
      pedantic: false,
      sanitize: true,
      smartLists: true,
      smartypants: false
    });

    this._highlightCodeBlocks();
  }

  render () {
    const {
      fontSize,
      lineWrapping,
      indentSize,
      keyMap,
      placeholder,
      defaultPreviewMode,
      className,
      handleRender,
      handleGetRenderContext
    } = this.props;

    const {markdown, compiled, renderError} = this.state;

    return (
      <Tabs className={classnames('markdown-editor', 'outlined', className)}
            forceRenderTabPanel
            selectedIndex={defaultPreviewMode ? 1 : 0}>
        <TabList>
          <Tab>
            <Button onClick={this._trackTab} value="Write">
              Write
            </Button>
          </Tab>
          <Tab>
            <Button onClick={this._trackTab} value="Preview">
              Preview
            </Button>
          </Tab>
        </TabList>
        <TabPanel className="markdown-editor__edit">
          <div className="form-control form-control--outlined">
            <CodeEditor
              hideGutters
              hideLineNumbers
              dynamicHeight
              manualPrettify
              noStyleActiveLine
              mode="text/plain"
              placeholder={placeholder}
              debounceMillis={300}
              keyMap={keyMap}
              fontSize={fontSize}
              lineWrapping={lineWrapping}
              indentSize={indentSize}
              defaultValue={markdown}
              render={handleRender}
              getRenderContext={handleGetRenderContext}
              onChange={this._handleChange}
            />
          </div>
          <div className="txt-sm italic faint">
            Styling with Markdown is supported
          </div>
        </TabPanel>
        <TabPanel className="markdown-editor__preview">
          {renderError && <p className="notice error no-margin">Failed to render: {renderError}</p>}
          <div className="markdown-editor__preview__content" ref={this._setPreviewRef}
               dangerouslySetInnerHTML={{__html: compiled}}>
            {/* Set from above */}
          </div>
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

  // Optional
  placeholder: PropTypes.string,
  defaultPreviewMode: PropTypes.bool,
  className: PropTypes.string
};

export default MarkdownEditor;
