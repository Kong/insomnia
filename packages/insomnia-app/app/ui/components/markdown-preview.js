import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import highlight from 'highlight.js';
import * as misc from '../../common/misc';
import { markdownToHTML } from '../../common/markdown-to-html';

@autobind
class MarkdownPreview extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      compiled: '',
      renderError: '',
    };
  }

  /**
   * Debounce and compile the markdown (won't debounce first render)
   */
  _compileMarkdown(markdown) {
    clearTimeout(this._compileTimeout);
    this._compileTimeout = setTimeout(
      async () => {
        try {
          const { handleRender } = this.props;
          const rendered = handleRender ? await handleRender(markdown) : markdown;
          const compiled = markdownToHTML(rendered);
          this.setState({
            compiled,
            renderError: '',
          });
        } catch (err) {
          this.setState({
            renderError: err.message,
            compiled: '',
          });
        }
      },
      this.state.compiled ? this.props.debounceMillis : 0,
    );
  }

  _setPreviewRef(n) {
    this._preview = n;
  }

  _handleClickLink(e) {
    e.preventDefault();
    misc.clickLink(e.target.getAttribute('href'));
  }

  _highlightCodeBlocks() {
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

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillUnmount() {
    clearTimeout(this._compileTimeout);
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillMount() {
    this._compileMarkdown(this.props.markdown);
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps) {
    this._compileMarkdown(nextProps.markdown);
  }

  componentDidUpdate() {
    this._highlightCodeBlocks();
  }

  componentDidMount() {
    this._highlightCodeBlocks();
  }

  render() {
    const { className, heading } = this.props;
    const { compiled, renderError } = this.state;

    let html = heading ? `<h1>${heading}</h1>\n${compiled}` : compiled;

    return (
      <div ref={this._setPreviewRef} className={classnames('markdown-preview', className)}>
        {renderError && <p className="notice error no-margin">Failed to render: {renderError}</p>}
        <div
          className="markdown-preview__content selectable"
          dangerouslySetInnerHTML={{ __html: html }}>
          {/* Set from above */}
        </div>
      </div>
    );
  }
}

MarkdownPreview.propTypes = {
  // Required
  markdown: PropTypes.string.isRequired,

  // Optional
  handleRender: PropTypes.func,
  className: PropTypes.string,
  debounceMillis: PropTypes.number,
  heading: PropTypes.string,
};

export default MarkdownPreview;
