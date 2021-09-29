import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import highlight from 'highlight.js';
import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG } from '../../common/constants';
import { clickLink } from '../../common/electron-helpers';
import { markdownToHTML } from '../../common/markdown-to-html';
import { HandleRender } from '../../common/render';

interface Props {
  markdown: string;
  handleRender?: HandleRender;
  className?: string;
  debounceMillis?: number;
  heading?: string;
}

interface State {
  compiled: string;
  renderError: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class MarkdownPreview extends PureComponent<Props, State> {
  state: State = {
    compiled: '',
    renderError: '',
  };

  _compileTimeout: NodeJS.Timeout | null = null;
  _preview: HTMLDivElement | null = null;

  /**
   * Debounce and compile the markdown (won't debounce first render)
   */
  _compileMarkdown(markdown) {
    if (this._compileTimeout !== null) {
      clearTimeout(this._compileTimeout);
    }
    // @ts-expect-error -- TSCONVERSION
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

  _setPreviewRef(n: HTMLDivElement) {
    this._preview = n;
  }

  _handleClickLink(e) {
    e.preventDefault();
    clickLink(e.target.getAttribute('href'));
  }

  _highlightCodeBlocks() {
    if (!this._preview) {
      return;
    }

    const el = ReactDOM.findDOMNode(this._preview);

    // @ts-expect-error -- TSCONVERSION
    for (const block of el.querySelectorAll('pre > code')) {
      highlight.highlightBlock(block);
    }

    // @ts-expect-error -- TSCONVERSION
    for (const a of el.querySelectorAll('a')) {
      a.title = `Open ${a.getAttribute('href')} in browser`;
      a.removeEventListener('click', this._handleClickLink);
      a.addEventListener('click', this._handleClickLink);
    }
  }

  componentWillUnmount() {
    if (this._compileTimeout !== null) {
      clearTimeout(this._compileTimeout);
    }
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillMount() {
    this._compileMarkdown(this.props.markdown);
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
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
    return (
      <div ref={this._setPreviewRef} className={classnames('markdown-preview', className)}>
        {renderError && <p className="notice error no-margin">Failed to render: {renderError}</p>}
        <div className="selectable">
          {heading ? <h1 className="markdown-preview__content-title">{heading}</h1> : null}
          <div className="markdown-preview__content" dangerouslySetInnerHTML={{ __html: compiled }} />
        </div>
      </div>
    );
  }
}
