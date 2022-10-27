import classnames from 'classnames';
import React, { forwardRef, ReactElement, useCallback, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

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
  const classes = classnames('react-tabs', 'markdown-editor', 'outlined', className, {
    'markdown-editor--dynamic-height': !tall,
  });

  const handleChange = useCallback((markdown: string) => {
    onChange(markdown);
    setMarkdown(markdown);
  }, [onChange]);

  return (
    <Tabs className={classes} defaultIndex={defaultPreviewMode ? 1 : 0}>
      <TabList>
        <Tab tabIndex="-1">
          <button value="Write">Write</button>
        </Tab>
        <Tab tabIndex="-1">
          <button value="Preview">Preview</button>
        </Tab>
      </TabList>
      <TabPanel className="react-tabs__tab-panel markdown-editor__edit">
        <div className="form-control form-control--outlined">
          <CodeEditor
            ref={ref}
            hideGutters
            hideLineNumbers
            dynamicHeight={!tall}
            manualPrettify
            noStyleActiveLine
            enableNunjucks
            mode={mode || 'text/x-markdown'}
            placeholder={placeholder}
            debounceMillis={300}
            defaultValue={markdown}
            onChange={handleChange}
          />
        </div>
        <div className="txt-sm italic faint">Styling with Markdown is supported</div>
      </TabPanel>
      <TabPanel className="react-tabs__tab-panel markdown-editor__preview">
        <MarkdownPreview markdown={markdown} />
      </TabPanel>
    </Tabs>
  );
});
MarkdownEditor.displayName = 'MarkdownEditor';
