import React, { forwardRef, type ReactElement, useCallback, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { CodeEditor, type CodeEditorHandle } from './codemirror/code-editor';
import { ErrorBoundary } from './error-boundary';
import { MarkdownPreview } from './markdown-preview';

interface Props {
  onChange: (arg: string) => void;
  defaultValue: string;
  placeholder?: string;
  className?: string;
  mode?: string;
  tall?: boolean;
}

export const MarkdownEditor = forwardRef<CodeEditorHandle, Props>(
  ({ mode, placeholder, tall, defaultValue, onChange }, ref): ReactElement => {
    // default value is added here to capture the original class component's behavior, but this way cuts the flow of prop change event after the initial rendering
    const [markdown, setMarkdown] = useState(defaultValue);

    const handleChange = useCallback(
      (markdown: string) => {
        onChange(markdown);
        setMarkdown(markdown);
      },
      [onChange],
    );

    return (
      <Tabs
        className="flex h-full w-full flex-col overflow-hidden"
        aria-label="Markdown editor tabs"
        defaultSelectedKey={defaultValue ? 'preview' : 'write'}
      >
        <TabList
          className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center gap-2 overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg] px-2"
          aria-label="Request scripts tabs"
        >
          <Tab
            className="flex h-[--line-height-xxs] w-[10.5rem] flex-shrink-0 cursor-pointer select-none items-center justify-between rounded-md px-2 py-1 text-sm text-[--hl] outline-none transition-colors duration-300 hover:bg-[rgba(var(--color-surprise-rgb),50%)] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] aria-selected:text-[--color-font-surprise]"
            id="write"
          >
            <div className="flex flex-1 items-center gap-2">
              <span>Write</span>
            </div>
          </Tab>
          <Tab
            className="flex h-[--line-height-xxs] w-[10.5rem] flex-shrink-0 cursor-pointer select-none items-center justify-between rounded-md px-2 py-1 text-sm text-[--hl] outline-none transition-colors duration-300 hover:bg-[rgba(var(--color-surprise-rgb),50%)] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] aria-selected:text-[--color-font-surprise]"
            id="preview"
          >
            <div className="flex flex-1 items-center gap-2">
              <span>Preview</span>
            </div>
          </Tab>
        </TabList>
        <TabPanel className="m-2 w-full flex-1 overflow-hidden" id="write">
          <ErrorBoundary errorClassName="tall wide vertically-align font-error pad text-center">
            <div className="flex h-full flex-col divide-y divide-solid divide-[--hl-md]">
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
        <TabPanel className="m-2 w-full flex-1 overflow-y-auto" id="preview">
          <ErrorBoundary errorClassName="tall wide vertically-align font-error pad text-center">
            <MarkdownPreview markdown={markdown} />
          </ErrorBoundary>
        </TabPanel>
      </Tabs>
    );
  },
);
MarkdownEditor.displayName = 'MarkdownEditor';
