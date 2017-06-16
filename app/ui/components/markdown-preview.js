import React, {PropTypes, PureComponent} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import highlight from 'highlight.js';
import * as misc from '../../common/misc';
import {markdownToHTML} from '../../common/markdown-to-html';

@autobind
class MarkdownPreview extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      compiled: '',
      renderError: ''
    };
  }

  async _compileMarkdown (markdown) {
    try {
      const rendered = await this.props.handleRender(markdown);
      this.setState({
        compiled: markdownToHTML(rendered),
        renderError: ''
      });
    } catch (err) {
      this.setState({
        renderError: err.message,
        compiled: ''
      });
    }
  }

  _setPreviewRef (n) {
    this._preview = n;
  }

  _handleClickLink (e) {
    e.preventDefault();
    misc.clickLink(e.target.getAttribute('href'));
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
      a.title = `Open ${a.getAttribute('href')} in browser`;
      a.removeEventListener('click', this._handleClickLink);
      a.addEventListener('click', this._handleClickLink);
    }
  }

  componentWillMount () {
    this._compileMarkdown(this.props.markdown);
  }

  componentDidUpdate () {
    this._highlightCodeBlocks();
  }

  componentWillReceiveProps (nextProps) {
    this._compileMarkdown(nextProps.markdown);
  }

  componentDidMount () {
    this._highlightCodeBlocks();
  }

  render () {
    const {className} = this.props;
    const {compiled, renderError} = this.state;

    return (
      <div ref={this._setPreviewRef} className={classnames('markdown-preview', className)}>
        {renderError && (
          <p className="notice error no-margin">
            Failed to render: {renderError}
          </p>
        )}
        <div className="markdown-preview__content selectable"
             dangerouslySetInnerHTML={{__html: compiled}}>
          {/* Set from above */}
        </div>
      </div>
    );
  }
}

MarkdownPreview.propTypes = {
  // Required
  markdown: PropTypes.string.isRequired,
  handleRender: PropTypes.func.isRequired,

  // Optional
  className: PropTypes.string
};

export default MarkdownPreview;
