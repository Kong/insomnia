import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Tab, TabList, TabPanel, Tabs} from 'react-tabs';
import Button from './base/button';
import {trackEvent} from '../../analytics';
import DebouncedInput from './base/debounced-input';
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
    this._handleValueChange = props.onChange;
    this._defaultValue = props.defaultValue;
    this._compiled = marked(this._defaultValue);
  }

  _trackTab (name) {
    trackEvent('Markdown', 'Editor', name);
  }

  _handleChange (value) {
    this._handleValueChange(value);
    this._compiled = marked(value);
  }

  render () {
    return (
      <div className="markdown">
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
            <div className="markdown--edit">
              <DebouncedInput delay={500} textarea={true} placeholder="..." defaultValue={this._defaultValue} onChange={this._handleChange}/>
            </div>
          </TabPanel>
          <TabPanel>
            <div className="markdown--preview"><div dangerouslySetInnerHTML={{__html: this._compiled}}></div></div>
          </TabPanel>
        </Tabs>
      </div>
    );
  }
}

Markdown.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  defaultValue: PropTypes.string.isRequired
};

export default Markdown;
