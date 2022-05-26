import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { createRef, PureComponent, RefObject } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import { AUTOBIND_CFG } from '../../common/constants';
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

interface State {
  markdown: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class MarkdownEditor extends PureComponent<Props, State> {
  _editorRef: RefObject<UnconnectedCodeEditor> = createRef();

  constructor(props: Props) {
    super(props);
    this.state = {
      markdown: props.defaultValue,
    };
  }

  _handleChange(markdown) {
    this.props.onChange(markdown);
    this.setState({
      markdown,
    });
  }

  focusEnd() {
    this._editorRef.current?.focusEnd();
  }

  focus() {
    this._editorRef.current?.focus();
  }

  render() {
    const {
      mode,
      placeholder,
      defaultPreviewMode,
      className,
      tall,
    } = this.props;
    const { markdown } = this.state;
    const classes = classnames('react-tabs', 'markdown-editor', 'outlined', className, {
      'markdown-editor--dynamic-height': !tall,
    });
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
              ref={this._editorRef}
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
              onChange={this._handleChange}
            />
          </div>
          <div className="txt-sm italic faint">Styling with Markdown is supported</div>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel markdown-editor__preview">
          <MarkdownPreview markdown={markdown} />
        </TabPanel>
      </Tabs>
    );
  }
}
