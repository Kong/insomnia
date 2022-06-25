import classnames from 'classnames';
import React, { forwardRef, ForwardRefRenderFunction, ReactElement, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import { Button } from './base/button';
import { CodeEditor,  UnconnectedCodeEditor } from './codemirror/code-editor';
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

const MarkdownEditorForwarded: ForwardRefRenderFunction<UnconnectedCodeEditor, Props> = ({
  mode,
  placeholder,
  defaultPreviewMode,
  className,
  tall,
  defaultValue,
  onChange,
}, ref): ReactElement => {
  const [markdown, setMarkdown] = useState(defaultValue); // this was we are cutting the flow of prop change event after the initial rendering
  const classes = classnames('react-tabs', 'markdown-editor', 'outlined', className, {
    'markdown-editor--dynamic-height': !tall,
  });

  const handleChange = (markdown: string): void => {
    onChange(markdown);
    setMarkdown(markdown);
  };

  return (
    <Tabs className={classes} defaultIndex={defaultPreviewMode ? 1 : 0}>
      <TabList>
        <Tab tabIndex="-1">
          <Button value="Write">Write</Button>
        </Tab>
        <Tab tabIndex="-1">
          <Button value="Preview">Preview</Button>
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
};

export const MarkdownEditor = forwardRef(MarkdownEditorForwarded);
