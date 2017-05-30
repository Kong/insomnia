import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Tab, TabList, TabPanel, Tabs} from 'react-tabs';
import {trackEvent} from '../../analytics';
import Button from './base/button';
import CodeEditor from './codemirror/code-editor';
import marked from 'marked';

marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: false
});

@autobind
class Markdown extends PureComponent {
  constructor (props) {
    super(props);
    this._defaultValue = props.defaultValue;
    this._compiled = marked(this._defaultValue);
  }

  _trackTab (name) {
    trackEvent('Request', 'Markdown Editor Tab', name);
  }

  _handleChange (value) {
    this.props.onChange(value);
    this._compiled = marked(value);
  }

  render () {
    return (
        <Tabs className="pane__body" forceRenderTabPanel>
          <TabList>
            <Tab>
              <Button onClick={this._trackTab} value="Write">
                Write
              </Button>
            </Tab>
            <Tab>
              <Button onClick={this._trackTab} value="Preview">
                Preview
              </Button>
            </Tab>
          </TabList>
          <TabPanel>
              <CodeEditor
                manualPrettify
                mode="text/x-markdown"
                placeholder="..."
                defaultValue={this._defaultValue}
                onChange={this._handleChange}
                {...this.props}
              />
          </TabPanel>
          <TabPanel>
            <div className="pad" dangerouslySetInnerHTML={{__html: this._compiled}}></div>
          </TabPanel>
        </Tabs>
    );
  }
}

Markdown.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  defaultValue: PropTypes.string.isRequired
};

export default Markdown;
