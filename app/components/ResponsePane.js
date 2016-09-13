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
import {getSetCookieHeaders} from '../lib/util';
import {cancelCurrentRequest} from '../lib/network';

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
      return;
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
      updateResponseFilter,
      loadingRequests,
      editorLineWrapping,
      editorFontSize,
      responseFilter,
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

          <br/>
          <i className="fa fa-refresh fa-spin"></i>

          <br/>
          <div className="pad">
            <button className="btn btn--super-compact btn--outlined"
                    onClick={() => cancelCurrentRequest()}>
              Cancel Request
            </button>
          </div>
        </div>
      )
    }

    if (!request) {
      return (
        <section className="response-pane pane">
          <header className="pane__header"></header>
          <div className="pane__body pane__body--placeholder"></div>
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

    const cookieHeaders = getSetCookieHeaders(response.headers);

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
                Cookies {cookieHeaders.length ? (
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
            <ResponseViewer
              key={response._id}
              contentType={response.contentType}
              previewMode={response.error ? PREVIEW_MODE_SOURCE : previewMode}
              filter={response.error ? '' : responseFilter}
              updateFilter={response.error ? null : updateResponseFilter}
              body={response.error ? response.error : response.body}
              error={!!response.error}
              editorLineWrapping={editorLineWrapping}
              editorFontSize={editorFontSize}
              url={response.url}
            />
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
  updateResponseFilter: PropTypes.func.isRequired,
  showCookiesModal: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired,
  responseFilter: PropTypes.string.isRequired,
  loadingRequests: PropTypes.object.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,

  // Other
  request: PropTypes.object
};

export default ResponsePane;
