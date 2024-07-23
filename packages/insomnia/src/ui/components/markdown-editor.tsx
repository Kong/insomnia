import React, { forwardRef, type ReactElement, useCallback, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { CodeEditor, type CodeEditorHandle } from './codemirror/code-editor';
import { ErrorBoundary } from './error-boundary';
import { MarkdownPreview } from './markdown-preview';

interface Props {
  onChange: Function;
  defaultValue: string;
  placeholder?: string;
  className?: string;
  mode?: string;
  tall?: boolean;
}

export const MarkdownEditor = forwardRef<CodeEditorHandle, Props>(({
  mode,
  placeholder,
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
    <Tabs
      className="w-full h-full flex flex-col overflow-hidden"
      aria-label="Markdown editor tabs"
      defaultSelectedKey={defaultValue ? 'preview' : 'write'}
    >
      <TabList className="w-full flex-shrink-0 overflow-x-auto border-solid border-b border-b-[--hl-md] px-2 bg-[--color-bg] flex items-center gap-2 h-[--line-height-sm]" aria-label="Request scripts tabs">
        <Tab
          className="rounded-md flex-shrink-0 h-[--line-height-xxs] text-sm flex items-center justify-between cursor-pointer w-[10.5rem] outline-none select-none px-2 py-1 hover:bg-[rgba(var(--color-surprise-rgb),50%)] text-[--hl] aria-selected:text-[--color-font-surprise] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] transition-colors duration-300"
          id="write"
        >
          <div className='flex flex-1 items-center gap-2'>
            <span>Write</span>
          </div>
        </Tab>
        <Tab
          className="rounded-md flex-shrink-0 h-[--line-height-xxs] text-sm flex items-center justify-between cursor-pointer w-[10.5rem] outline-none select-none px-2 py-1 hover:bg-[rgba(var(--color-surprise-rgb),50%)] text-[--hl] aria-selected:text-[--color-font-surprise] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] transition-colors duration-300"
          id="preview"
        >
          <div className='flex flex-1 items-center gap-2'>
            <span>Preview</span>
          </div>
        </Tab>
      </TabList>
      <TabPanel className="w-full flex-1 overflow-hidden m-2" id='write'>
        <ErrorBoundary
          errorClassName="tall wide vertically-align font-error pad text-center"
        >
          <div className='h-full flex flex-col divide-y divide-solid divide-[--hl-md]'>
            <CodeEditor
              id="markdown-editor"
              ref={ref}
              hideGutters
              hideLineNumbers
              dynamicHeight={!tall}
              showPrettifyButton
              noStyleActiveLine
              mode={mode || 'text/x-markdown'}
              placeholder={placeholder}
              defaultValue={markdown}
              onChange={handleChange}
            />
          </div>
        </ErrorBoundary>
      </TabPanel>
      <TabPanel className="w-full flex-1 overflow-y-auto m-2" id="preview">
        <ErrorBoundary
          errorClassName="tall wide vertically-align font-error pad text-center"
        >
          <MarkdownPreview markdown={markdown} />
        </ErrorBoundary>
      </TabPanel>
    </Tabs>

  );
});
MarkdownEditor.displayName = 'MarkdownEditor';
