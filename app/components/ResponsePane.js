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
      <section className="response-pane pane">
        <header className="pane__header"></header>
        <div className="pane__body pane__body--placeholder">
          <h1>Nothing Yet...</h1>
          <p>Click the <em>Send</em> button to trigger a request</p>
        </div>
      </section>
    )
  }

  return (
    <section className="response-pane pane">
      <header className="pane__header">
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
      <Tabs className="pane__body">
        <TabList>
          <Tab>
            <button>{getPreviewModeName(previewMode)}</button>
            <PreviewModeDropdown
              previewMode={previewMode}
              updatePreviewMode={updatePreviewMode}
            />
          </Tab>
          <Tab><button>Headers</button></Tab>
        </TabList>
        <TabPanel>
          <ResponseViewer
            contentType={response.contentType}
            previewMode={previewMode}
            body={response.body}
          />
        </TabPanel>
        <TabPanel className="scrollable pad">
          <table className="wide">
            <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
            </thead>
            <tbody>
            {response.headers.map((h, i) => (
              <tr className="selectable" key={i}>
                <td>{h.name}</td>
                <td>{h.value}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </TabPanel>
      </Tabs>
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
