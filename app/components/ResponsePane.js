import React, {PropTypes, Component} from 'react';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'

import StatusTag from './StatusTag';
import SizeTag from './SizeTag';
import TimeTag from './TimeTag';
import PreviewModeDropdown from './PreviewModeDropdown';
import ResponseBodyViewer from './ResponseBodyViewer';
import ResponseHeadersViewer from './ResponseHeadersViewer';
import {getPreviewModeName} from '../lib/previewModes';
import {PREVIEW_MODE_SOURCE} from '../lib/previewModes';
import {REQUEST_TIME_TO_SHOW_COUNTER} from '../lib/constants';
import {MOD_SYM} from '../lib/constants';
import {trackEvent} from '../lib/analytics';

class ResponsePane extends Component {
  render () {
    const {
      response,
      request,
      previewMode,
      updatePreviewMode,
      loadingRequests,
      editorLineWrapping,
      editorFontSize
    } = this.props;

    const loadStartTime = loadingRequests[request ? request._id : '__NONE__'];
    let timer = null;

    if (loadStartTime) {
      // Set a timer to update the UI again soon
      setTimeout(() => {
        this.forceUpdate();
      }, 30);

      // NOTE: We subtract 200ms because the request has some time padding on either end
      const elapsedTime = Math.round((Date.now() - loadStartTime - 200) / 100) / 10;

      timer = (
        <div className="response-pane__overlay">
          {elapsedTime > REQUEST_TIME_TO_SHOW_COUNTER ? (
            <h2>{elapsedTime} seconds...</h2>
          ) : (
            <h2>Loading...</h2>
          )}

          <i className="fa fa-refresh fa-spin"></i>

          {false && elapsedTime > REQUEST_TIME_TO_SHOW_COUNTER ? (
            // TODO: implement cancel requests
            <button className="btn btn--compact bg-danger">Cancel Request</button>
          ) : null}
        </div>
      )
    }
    if (!request) {
      return (
        <section className="response-pane pane">
          <header className="pane__header"></header>
          <div className="pane__body pane__body--placeholder text-center pad"></div>
        </section>
      )
    }

    if (!response) {
      return (
        <section className="response-pane pane">
          {timer}

          <header className="pane__header"></header>
          <div className="pane__body pane__body--placeholder">
            <div>
              <table>
                <tbody>
                <tr>
                  <td>Send Request</td>
                  <td><code>{MOD_SYM}Enter</code></td>
                </tr>
                <tr>
                  <td>Focus Url Bar</td>
                  <td><code>{MOD_SYM}L</code></td>
                </tr>
                <tr>
                  <td>Switch Requests</td>
                  <td><code>{MOD_SYM}P</code></td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className="response-pane pane">
        {timer}

        <header className="pane__header pad no-wrap">
          {!response ? null : (
            <div>
              <StatusTag
                statusCode={response.statusCode}
                statusMessage={response.statusMessage}
              />
              <TimeTag milliseconds={response.elapsedTime}/>
              <SizeTag bytes={response.bytesRead}/>
            </div>
          )}
        </header>
        <Tabs className="pane__body">
          <TabList>
            <Tab>
              <button onClick={e => trackEvent('Response Tab Clicked', {name: 'Body'})}>
                {getPreviewModeName(previewMode)}
              </button>
              <PreviewModeDropdown
                previewMode={previewMode}
                updatePreviewMode={updatePreviewMode}
              />
            </Tab>
            <Tab>
              <button onClick={e => trackEvent('Response Tab Clicked', {name: 'Headers'})}>
                Headers {response.headers.length ? (
                <span className="txt-sm">({response.headers.length})</span> ) : null}
              </button>
            </Tab>
          </TabList>
          <TabPanel>
            {response.error ? (
              <ResponseBodyViewer
                key={response._id}
                contentType={response.contentType}
                previewMode={PREVIEW_MODE_SOURCE}
                editorLineWrapping={editorLineWrapping}
                editorFontSize={editorFontSize}
                body={response.error}
                url={response.url}
              />
            ) : (
              <ResponseBodyViewer
                key={response._id}
                contentType={response.contentType}
                previewMode={previewMode}
                editorLineWrapping={editorLineWrapping}
                editorFontSize={editorFontSize}
                body={response.body}
                url={response.url}
                wrap={true} // TODO: Make this a user preference
              />
            )}
          </TabPanel>
          <TabPanel className="scrollable pad">
            <ResponseHeadersViewer
              key={response._id}
              headers={response.headers}
            />
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
  loadingRequests: PropTypes.object.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,

  // Other
  response: PropTypes.object,
  request: PropTypes.object
};

export default ResponsePane;
