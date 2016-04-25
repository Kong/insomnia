import React, {Component, PropTypes} from 'react'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'

import Dropdown from '../components/base/Dropdown'
import Editor from '../components/base/Editor'
import StatusTag from '../components/StatusTag'
import SizeTag from '../components/SizeTag'
import TimeTag from '../components/TimeTag'

class ResponsePane extends Component {
  render () {
    const {
      response
    } = this.props;

    if (!response) {
      return (
        <section className="grid__cell section grid--v grid--start">
          <header className="header bg-light section__header"></header>
          <div className="section__body grid__cell"></div>
        </section>
      )
    }

    return (
      <section className="grid__cell section">
        <div className="grid--v wide">
          <header
            className="grid grid--center header text-center bg-super-light txt-sm section__header">
            {!response ? null : (
              <div>
                <StatusTag
                  statusCode={response.statusCode}
                  statusMessage={response.statusMessage}
                />
                <TimeTag milliseconds={response.millis}/>
                <SizeTag bytes={response.bytes}/>
              </div>
            )}
          </header>
          <Tabs className="grid__cell grid--v section__body">
            <TabList className="grid grid--start">
              <Tab className="no-wrap grid grid--center">
                <button>Preview</button>
                <Dropdown>
                  <button><i className="fa fa-caret-down"></i></button>
                  <ul>
                    <li><button><i className="fa fa-eye"></i> Preview</button></li>
                    <li><button><i className="fa fa-code"></i> Formatted</button></li>
                    <li><button><i className="fa fa-file"></i> Raw</button></li>
                  </ul>
                </Dropdown>
              </Tab>
              <Tab><button>Headers</button></Tab>
            </TabList>
            <TabPanel className="grid__cell editor-wrapper">
              <Editor
                value={response && response.body || ''}
                prettify={true}
                options={{
                    mode: response && response.contentType || 'text/plain',
                    readOnly: true,
                    placeholder: 'nothing yet...'
                  }}
              />
            </TabPanel>
            <TabPanel className="grid__cell grid__cell--scroll--v">
              <div className="wide">
                <div className="grid--v grid--start pad">
                  {!response ? null : response.headers.map((h, i) => (
                    <div className="grid grid__cell grid__cell--no-flex selectable" key={i}>
                      <div className="grid__cell">{h.name}</div>
                      <div className="grid__cell">{h.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </section>
    )
  }
}

ResponsePane.propTypes = {
  response: PropTypes.object
};

export default ResponsePane;
