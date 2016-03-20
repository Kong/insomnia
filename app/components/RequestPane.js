import React, {Component, PropTypes} from 'react'
import Editor from '../components/Editor'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

class RequestPane extends Component {
  shouldComponentUpdate (nextProps, nextState) {
    return nextProps.request !== this.props.request
  }

  render () {
    const {request, updateRequest} = this.props;

    return (
      <section id="request" className="pane col grid-v">
        <header className="pane__header bg-super-light">
          <div className="form-control url-input">
            <div className="grid">
              <button className="btn method-dropdown">
                POST&nbsp;&nbsp;<i className="fa fa-caret-down"></i>
              </button>
              <input type="text" placeholder="https://google.com"/>
              <button className="btn send-request-button">
                <i className="fa fa-repeat txt-xl"></i>
              </button>
            </div>
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
              <Editor value={request.body}
                      onChange={(body) => updateRequest(Object.assign({}, request, {body}) )}
                      debounceMillis={500}
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
  updateRequest: PropTypes.func.isRequired,
  request: PropTypes.object.isRequired
};

export default RequestPane;
