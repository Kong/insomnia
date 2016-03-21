import React, {Component, PropTypes} from 'react'
import CodeEditor from '../components/CodeEditor'
import UrlInput from '../components/UrlInput'
import {METHOD_GET} from '../constants/global'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

class RequestPane extends Component {
  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.request !== this.props.request;
  }

  render () {
    const {
      request,
      updateRequestBody,
      updateRequestUrl,
      updateRequestMethod
    } = this.props;

    return (
      <section id="request" className="pane col grid-v">
        <header className="pane__header bg-super-light">
          <UrlInput onUrlChange={updateRequestUrl}
                    onMethodChange={updateRequestMethod}
                    method={request.method}
                    urlValue={request.url}/>
        </header>
        <div className="pane__body grid-v">
          <Tabs selectedIndex={0} className="grid-v">
            <TabList className="pane__header grid">
              <Tab>
                <button className="btn">Body</button>
              </Tab>
              <Tab>
                <button className="btn">Params</button>
              </Tab>
              <Tab>
                <button className="btn">Auth</button>
              </Tab>
              <Tab>
                <button className="btn">Headers</button>
              </Tab>
            </TabList>
            <TabPanel className="grid-v">
              <CodeEditor value={request.body}
                          className="grid-v"
                          onChange={updateRequestBody}
                          options={{mode: request._mode}}/>
            </TabPanel>
            <TabPanel className="grid-v">Params</TabPanel>
            <TabPanel className="grid-v">Basic Auth</TabPanel>
            <TabPanel className="grid-v">Headers</TabPanel>
          </Tabs>
        </div>
      </section>
    );
  }
}

RequestPane.propTypes = {
  updateRequestUrl: PropTypes.func.isRequired,
  updateRequestBody: PropTypes.func.isRequired,
  updateRequestMethod: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired
};

export default RequestPane;
