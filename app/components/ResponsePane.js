import React, {PropTypes, Component} from 'react'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'

import StatusTag from './StatusTag'
import SizeTag from './SizeTag'
import TimeTag from './TimeTag'
import PreviewModeDropdown from '../components/PreviewModeDropdown'
import ResponseViewer from '../components/ResponseViewer'
import {getPreviewModeName} from '../lib/previewModes'
import {PREVIEW_MODE_SOURCE} from "../lib/previewModes";

class ResponsePane extends Component {
  render () {
    const {response, previewMode, updatePreviewMode} = this.props;
    if (!response) {
      return (
        <section className="response-pane pane">
          <header className="pane__header"></header>
          <div className="pane__body pane__body--placeholder text-center pad">
            <h1>Nothing Yet...</h1>
            <p>Click the <em>Send</em> button to trigger a request</p>
          </div>
        </section>
      )
    }

    return (
      <section className="response-pane pane">
        <header className="pane__header pad no-wrap">
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
            <Tab>
              <button>
                Headers {response.headers.length ? (
                <span className="txt-sm">({response.headers.length})</span> ) : null}
              </button>
            </Tab>
          </TabList>
          <TabPanel>
            {response.error ? (
              <ResponseViewer
                contentType={response.contentType}
                previewMode={PREVIEW_MODE_SOURCE}
                body={response.error}
                wrap={true}
              />
            ) : (
              <ResponseViewer
                contentType={response.contentType}
                previewMode={previewMode}
                body={response.body}
                wrap={true} // TODO: Make this a user preference
              />
            )}
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
  }
}

ResponsePane.propTypes = {
  // Functions
  updatePreviewMode: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired,

  // Other
  response: PropTypes.object

};

export default ResponsePane;
