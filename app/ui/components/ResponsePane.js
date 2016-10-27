import React, {PropTypes, Component} from 'react';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import ElmComponent from './ElmComponent';
import {ResponsePaneHeader} from './ResponsePaneHeader.elm';
import PreviewModeDropdown from './dropdowns/PreviewModeDropdown';
import ResponseViewer from './viewers/ResponseViewer';
import ResponseHeadersViewer from './viewers/ResponseHeadersViewer';
import ResponseCookiesViewer from './viewers/ResponseCookiesViewer';
import * as db from '../../backend/database';
import {
  getPreviewModeName,
  PREVIEW_MODE_SOURCE
} from '../../backend/previewModes';
import {
  REQUEST_TIME_TO_SHOW_COUNTER,
  MOD_SYM,
  RESPONSE_CODE_DESCRIPTIONS
} from '../../backend/constants';
import {getSetCookieHeaders} from '../../backend/util';
import {cancelCurrentRequest} from '../../backend/network';

class ResponsePane extends Component {
  constructor (props) {
    super(props);

    this.state = {
      response: null
    }
  }

  async _getResponse (request) {
    if (!request) {
      this.setState({response: null});
    } else {
      const response = await db.response.getLatestByParentId(request._id);
      this.setState({response});
    }
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
        {!response ? null : (
          <ElmComponent
            component={ResponsePaneHeader}
            container={<header
              className="pane__header pad-left pad-right no-wrap"/>}
            statusCode={response.statusCode}
            statusDescription={RESPONSE_CODE_DESCRIPTIONS[response.statusCode] || ''}
            statusMessage={response.statusMessage}
            elapsedTime={response.elapsedTime}
            bytesRead={response.bytesRead}
          />
        )}
        <Tabs className="pane__body">
          <TabList>
            <Tab>
              <button>
                {getPreviewModeName(previewMode)}
              </button>
              <PreviewModeDropdown
                previewMode={previewMode}
                updatePreviewMode={updatePreviewMode}
              />
            </Tab>
            <Tab>
              <button>
                Cookies {cookieHeaders.length ? (
                <span className="txt-sm">
                    ({cookieHeaders.length})
                  </span>
              ) : null}
              </button>
            </Tab>
            <Tab>
              <button>
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
              bytes={response.bytesRead}
              previewMode={response.error ? PREVIEW_MODE_SOURCE : previewMode}
              filter={response.error ? '' : responseFilter}
              updateFilter={response.error ? null : updateResponseFilter}
              body={response.error ? response.error : response.body}
              encoding={response.encoding}
              error={!!response.error}
              responseId={response._id}
              editorLineWrapping={editorLineWrapping}
              editorFontSize={editorFontSize}
              url={response.url}
            />
          </TabPanel>
          <TabPanel className="scrollable-container">
            <div className="scrollable pad">
              <ResponseCookiesViewer
                showCookiesModal={showCookiesModal}
                key={response._id}
                headers={cookieHeaders}
              />
            </div>
          </TabPanel>
          <TabPanel className="scrollable-container">
            <div className="scrollable pad">
              <ResponseHeadersViewer
                key={response._id}
                headers={response.headers}
              />
            </div>
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
