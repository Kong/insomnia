import React, {PropTypes} from 'react'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'

import StatusTag from '../components/StatusTag'
import SizeTag from '../components/SizeTag'
import TimeTag from '../components/TimeTag'
import PreviewModeDropdown from '../components/PreviewModeDropdown'
import ResponseViewer from '../components/ResponseViewer'
import {getPreviewModeName} from '../lib/previewModes'

const ResponsePane = ({response, previewMode, updatePreviewMode}) => {
  if (!response) {
    return (
      <section className="grid__cell section grid--v grid--start">
        <header className="header bg-light section__header"></header>
        <div className="section__body grid__cell grid grid--center">
          <div className="faint text-center">
            <h1>Nothing Yet...</h1>
            <p>Click the <em>Send</em> button to trigger a request</p>
            <br/>
          </div>
        </div>
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
              <button>{getPreviewModeName(previewMode)}</button>
              <PreviewModeDropdown
                previewMode={previewMode}
                updatePreviewMode={updatePreviewMode}
              />
            </Tab>
            <Tab><button>Headers</button></Tab>
          </TabList>
          <TabPanel className="grid__cell grid">
            <ResponseViewer
              contentType={response.contentType}
              previewMode={previewMode}
              body={response.body}
            />
          </TabPanel>
          <TabPanel className="grid__cell grid__cell--scroll--v">
            <div className="wide">
              <div className="grid--v grid--start pad">
                {response.headers.map((h, i) => (
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
};

ResponsePane.propTypes = {
  // Functions
  updatePreviewMode: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired,

  // Other
  response: PropTypes.object

};

export default ResponsePane;
