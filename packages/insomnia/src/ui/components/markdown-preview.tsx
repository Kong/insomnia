import classnames from 'classnames';
import highlight from 'highlight.js/lib/common';
import React, { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { markdownToHTML } from '../../common/markdown-to-html';
import { HandleRender } from '../../common/render';

interface Props {
  markdown: string;
  handleRender?: HandleRender;
  className?: string;
  heading?: string;
}

export const MarkdownPreview: FC<Props> = ({ markdown, className, heading }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [compiled, setCompiled] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let shouldUpdate = true;
    const fn = async () => {
      try {
        const compiled = markdownToHTML(markdown);
        shouldUpdate && setCompiled(compiled);
        shouldUpdate && setError('');
      } catch (err) {
        shouldUpdate && setCompiled('');
        shouldUpdate && setError(err.message);
      }
    };
    fn();
    return () => {
      shouldUpdate = false;
    };
  }, [markdown]);
  useLayoutEffect(() => {
    if (!divRef.current) {
      return;
    }
    for (const block of divRef.current.querySelectorAll('pre > code')) {
      if (block instanceof HTMLElement) {
        highlight.highlightElement(block);
      }
    }
    for (const a of divRef.current.querySelectorAll('a')) {
      a.title = `Open ${a.getAttribute('href')} in browser`;
      a.removeEventListener('click', _handleClickLink);
      a.addEventListener('click', _handleClickLink);
    }
  }, [compiled]);
  const _handleClickLink = (event: any) => {
    event.preventDefault();
    window.main.openInBrowser(event.target.getAttribute('href'));
  };

  return (
    <div ref={divRef} className={classnames('markdown-preview', className)}>
      {error ? <p className="notice error no-margin">Failed to render: {error}</p> : null}
      <div className="selectable">
        {heading ? <h1 className="markdown-preview__content-title">{heading}</h1> : null}
        <div className="markdown-preview__content" dangerouslySetInnerHTML={{ __html: compiled }} />
      </div>
    </div>
  );
};
