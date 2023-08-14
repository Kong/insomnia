import React, { forwardRef, ReactElement, useCallback, useState } from 'react';
import styled from 'styled-components';

import { PanelContainer, TabItem, Tabs } from './base/tabs';
import { CodeEditor, CodeEditorHandle } from './codemirror/code-editor';
import { MarkdownPreview } from './markdown-preview';

interface Props {
  onChange: Function;
  defaultValue: string;
  placeholder?: string;
  defaultPreviewMode?: boolean;
  className?: string;
  mode?: string;
  tall?: boolean;
}

interface MarkdownEditProps {
  withDynamicHeight: boolean;
}

const Wrapper = styled.div({
  border: '1px solid var(--hl-md)',
  boxSizing: 'border-box',
});

const MarkdownEdit = styled.div<MarkdownEditProps>(({ withDynamicHeight }) => ({
  padding: 'var(--padding-xs) var(--padding-sm)',

  ...withDynamicHeight ? {
    '.CodeMirror-scroll': {
      // Not sure why this style doesn't work on .CodeMirror...
      maxHeight: '30vh',
    },

    '.input': {
      height: 'auto !important',
    },
  } : {
    height: '100%',
    display: 'grid',
    gridTemplateRows: '1fr auto',

    '.input': {
      height: '100%',
    },
  },
}));

const MarkdownPreiview = styled.div({
  maxHeight: '35vh',
  padding: 'var(--padding-sm)',
  overflow: 'auto',
});

export const MarkdownEditor = forwardRef<CodeEditorHandle, Props>(({
  mode,
  placeholder,
  defaultPreviewMode,
  className,
  tall,
  defaultValue,
  onChange,
}, ref): ReactElement => {
  // default value is added here to capture the original class component's behavior, but this way cuts the flow of prop change event after the initial rendering
  const [markdown, setMarkdown] = useState(defaultValue);

  const handleChange = useCallback((markdown: string) => {
    onChange(markdown);
    setMarkdown(markdown);
  }, [onChange]);

  return (
    <Wrapper className={className}>
      <Tabs
        aria-label="Markdown editor tabs"
        defaultSelectedKey={defaultPreviewMode ? 'preview' : 'write' }
      >
        <TabItem key="write" title="Write">
          <MarkdownEdit withDynamicHeight={!tall}>
            <div className='form-control form-control--outlined'>
              <CodeEditor
                id="markdown-editor"
                ref={ref}
                hideGutters
                hideLineNumbers
                dynamicHeight={!tall}
                showPrettifyButton
                noStyleActiveLine
                enableNunjucks
                mode={mode || 'text/x-markdown'}
                placeholder={placeholder}
                defaultValue={markdown}
                onChange={handleChange}
              />
            </div>
            <div className='txt-sm italic faint'>
              Styling with Markdown is supported
            </div>
          </MarkdownEdit>
        </TabItem>
        <TabItem key="preview" title="Preview">
          <MarkdownPreiview>
            <PanelContainer className="markdown-editor__preview">
              <MarkdownPreview markdown={markdown} />
            </PanelContainer>
          </MarkdownPreiview>
        </TabItem>
      </Tabs>
    </Wrapper>
  );
});
MarkdownEditor.displayName = 'MarkdownEditor';
