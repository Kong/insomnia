import * as db from '../database';
import React, {PropTypes, Component} from 'react';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import ResponsePaneHeader from './ResponsePaneHeader';
import PreviewModeDropdown from './dropdowns/PreviewModeDropdown';
import ResponseViewer from './viewers/ResponseViewer';
import ResponseHeadersViewer from './viewers/ResponseHeadersViewer';
import ResponseCookiesViewer from './viewers/ResponseCookiesViewer';
import {getPreviewModeName, PREVIEW_MODE_SOURCE} from '../lib/previewModes';
import {REQUEST_TIME_TO_SHOW_COUNTER, MOD_SYM} from '../lib/constants';
import {trackEvent} from '../lib/analytics';

class ResponsePane extends Component {
  constructor (props) {
    super(props);

    this.state = {
      response: null
    }
  }

  _getResponse (request) {
    if (!request) {
      this.setState({response: null});
    }

    db.responseGetLatestByParentId(request._id).then(response => {
      this.setState({response});
    })
  }

  componentWillReceiveProps (nextProps) {
    this._getResponse(nextProps.request);
  }

  componentDidMount () {
    this._getResponse(this.props.request);
  }

  render () {
    const {
      request,
      previewMode,
      updatePreviewMode,
      loadingRequests,
      editorLineWrapping,
      editorFontSize,
      showCookiesModal
    } = this.props;

    const {response} = this.state;

    const loadStartTime = loadingRequests[request ? request._id : '__NONE__'];
    let timer = null;

    if (loadStartTime) {
      // Set a timer to update the UI again soon
      // TODO: Move this into a child component so we don't rerender too much
      setTimeout(() => {
        this.forceUpdate();
      }, 100);

      // NOTE: subtract 200ms because the request has some time on either end
      const millis = Date.now() - loadStartTime - 200;
      const elapsedTime = Math.round(millis / 100) / 10;

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
            <button className="btn btn--compact bg-danger">
              Cancel Request
            </button>
          ) : null}
        </div>
      )
    }
    if (!request) {
      return (
        <section className="response-pane pane">
          <header className="pane__header"></header>
          <div className="pane__body pane__body--placeholder text-center pad">
          </div>
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
                  <td className="text-right">
                    <code>{MOD_SYM}Enter</code>
                  </td>
                </tr>
                <tr>
                  <td>Focus Url Bar</td>
                  <td className="text-right">
                    <code>{MOD_SYM}L</code>
                  </td>
                </tr>
                <tr>
                  <td>Manage Cookies</td>
                  <td className="text-right">
                    <code>{MOD_SYM}K</code>
                  </td>
                </tr>
                <tr>
                  <td>Edit Environments</td>
                  <td className="text-right">
                    <code>{MOD_SYM}E</code>
                  </td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )
    }

    const cookieHeaders = response.headers.filter(
      h => h.name.toLowerCase() === 'set-cookie'
    );

    return (
      <section className="response-pane pane">
        {timer}

        <header className="pane__header pad no-wrap">
          {!response ? null : (
            <ResponsePaneHeader
              statusCode={response.statusCode}
              statusMessage={response.statusMessage}
              elapsedTime={response.elapsedTime}
              bytesRead={response.bytesRead}
            />
          )}
        </header>
        <Tabs className="pane__body">
          <TabList>
            <Tab>
              <button
                onClick={e => trackEvent('Response Tab Clicked', {name: 'Body'})}>
                {getPreviewModeName(previewMode)}
              </button>
              <PreviewModeDropdown
                previewMode={previewMode}
                updatePreviewMode={updatePreviewMode}
              />
            </Tab>
            <Tab>
              <button
                onClick={e => trackEvent('Cookies Tab Clicked', {name: 'Cookies'})}>
                Cookies
                {cookieHeaders.length ? (
                  <span className="txt-sm">
                    ({cookieHeaders.length})
                  </span>
                ) : null}
              </button>
            </Tab>
            <Tab>
              <button
                onClick={e => trackEvent('Response Tab Clicked', {name: 'Headers'})}>
                Headers {response.headers.length ? (
                <span className="txt-sm">
                  ({response.headers.length})
                </span>
              ) : null}
              </button>
            </Tab>
          </TabList>
          <TabPanel>
            {response.error ? (
              <ResponseViewer
                key={response._id}
                contentType={response.contentType}
                previewMode={PREVIEW_MODE_SOURCE}
                editorLineWrapping={editorLineWrapping}
                editorFontSize={editorFontSize}
                body={response.error}
                error={true}
                url={response.url}
              />
            ) : (
              <ResponseViewer
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
            <ResponseCookiesViewer
              showCookiesModal={showCookiesModal}
              key={response._id}
              headers={cookieHeaders}
            />
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
  showCookiesModal: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired,
  loadingRequests: PropTypes.object.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,

  // Other
  request: PropTypes.object
};

export default ResponsePane;
