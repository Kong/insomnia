import React, {Component, PropTypes} from 'react'
import CodeEditor from '../components/CodeEditor'
import UrlInput from '../components/UrlInput'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

class RequestPane extends Component {
  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.request !== this.props.request;
  }

  render () {
    const {request, updateRequestBody, updateRequestUrl} = this.props;

    return (
      <section id="request" className="pane col grid-v">
        <header className="pane__header bg-super-light">
          <div className="form-control url-input">
            <UrlInput onUrlChange={updateRequestUrl}
                      urlValue={request.url}/>
          </div>
        </header>
        <div className="pane__body">
          <Tabs selectedIndex={1} className="grid-v">
            <TabList className="grid pane__header">
              <Tab>
                <button className="btn">Params</button>
              </Tab>
              <Tab>
                <button className="btn">Body</button>
              </Tab>
              <Tab>
                <button className="btn">Basic Auth</button>
              </Tab>
              <Tab>
                <button className="btn">Headers</button>
              </Tab>
            </TabList>
            <TabPanel className="col">Params</TabPanel>
            <TabPanel className="col">
              <CodeEditor value={request.body}
                          onChange={updateRequestBody}
                          options={{mode: request._mode, lineNumbers: true}}/>
            </TabPanel>
            <TabPanel className="col">Basic Auth</TabPanel>
            <TabPanel className="col">Headers</TabPanel>
          </Tabs>
        </div>
      </section>
    );
  }
}

RequestPane.propTypes = {
  updateRequestUrl: PropTypes.func.isRequired,
  updateRequestBody: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired
};

export default RequestPane;
