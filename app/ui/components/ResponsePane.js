import React, {PropTypes, Component} from 'react';
import fs from 'fs';
import mime from 'mime-types';
import {remote} from 'electron';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import SizeTag from './tags/SizeTag';
import StatusTag from './tags/StatusTag';
import TimeTag from './tags/TimeTag';
import PreviewModeDropdown from './dropdowns/PreviewModeDropdown';
import ResponseViewer from './viewers/ResponseViewer';
import ResponseHistoryDropdown from './dropdowns/ResponseHistoryDropdown';
import ResponseTimer from './ResponseTimer';
import ResponseHeadersViewer from './viewers/ResponseHeadersViewer';
import ResponseCookiesViewer from './viewers/ResponseCookiesViewer';
import * as models from '../../models';
import {MOD_SYM, PREVIEW_MODE_SOURCE, getPreviewModeName} from '../../common/constants';
import {getSetCookieHeaders} from '../../common/misc';
import {cancelCurrentRequest} from '../../common/network';
import {trackEvent} from '../../analytics';

class ResponsePane extends Component {
  state = {response: null};

  async _getResponse (requestId, responseId) {
    let response = await models.response.getById(responseId);

    if (!response) {
      response = await models.response.getLatestByParentId(requestId);
    }

    this.setState({response});
  }

  async _handleDownloadResponseBody () {
    if (!this.state.response) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    const {body, encoding, contentType} = this.state.response;
    const bodyBuffer = new Buffer(body, encoding);
    const extension = mime.extension(contentType) || '';

    const options = {
      title: 'Save Response',
      buttonLabel: 'Save',
      filters: [{
        name: 'Download', extensions: [extension],
      }]
    };

    remote.dialog.showSaveDialog(options, filename => {
      if (!filename) {
        trackEvent('Response', 'Save Cancel');
        return;
      }

      fs.writeFile(filename, bodyBuffer, {}, err => {
        if (err) {
          console.warn('Failed to save response body', err);
          trackEvent('Response', 'Save Failure');
        } else {
          trackEvent('Response', 'Save Success');

        }
      });
    });
  }

  componentWillReceiveProps (nextProps) {
    const activeRequestId = nextProps.request ? nextProps.request._id : null;
    const activeResponseId = nextProps.activeResponseId;
    this._getResponse(activeRequestId, activeResponseId);
  }

  componentDidMount () {
    const activeRequestId = this.props.request ? this.props.request._id : null;
    const activeResponseId = this.props.activeResponseId;
    this._getResponse(activeRequestId, activeResponseId);
  }

  render () {
    const {
      request,
      previewMode,
      handleSetPreviewMode,
      handleSetActiveResponse,
      handleDeleteResponses,
      handleSetFilter,
      loadStartTime,
      editorLineWrapping,
      editorFontSize,
      filter,
      activeResponseId,
      showCookiesModal
    } = this.props;

    const {response} = this.state;

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
          <ResponseTimer
            className="response-pane__overlay"
            handleCancel={cancelCurrentRequest}
            loadStartTime={loadStartTime}
          />

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
        <ResponseTimer
          className="response-pane__overlay"
          handleCancel={cancelCurrentRequest}
          loadStartTime={loadStartTime}
        />
        {!response ? null : (
          <header className="pane__header row-spaced">
            <div className="no-wrap scrollable scrollable--no-bars pad-left">
              <StatusTag
                statusCode={response.statusCode}
                statusMessage={response.statusMessage || null}
              />
              <TimeTag milliseconds={response.elapsedTime} startTime={response.created}/>
              <SizeTag bytes={response.bytesRead}/>
            </div>
            <ResponseHistoryDropdown
              requestId={request._id}
              isLatestResponseActive={!activeResponseId}
              activeResponseId={response._id}
              handleSetActiveResponse={handleSetActiveResponse}
              handleDeleteResponses={handleDeleteResponses}
              onChange={() => null}
              className="tall pane__header__right"
              right={true}
            />
          </header>
        )}
        <Tabs className="pane__body">
          <TabList>
            <Tab onClick={() => trackEvent('Response Pane', 'View', 'Response')}>
              <button>
                {getPreviewModeName(previewMode)}
              </button>
              <PreviewModeDropdown
                download={this._handleDownloadResponseBody.bind(this)}
                previewMode={previewMode}
                updatePreviewMode={handleSetPreviewMode}
              />
            </Tab>
            <Tab onClick={() => trackEvent('Response Pane', 'View', 'Cookies')}>
              <button>
                Cookies {cookieHeaders.length ? (
                <span className="txt-sm">
                    ({cookieHeaders.length})
                  </span>
              ) : null}
              </button>
            </Tab>
            <Tab onClick={() => trackEvent('Response Pane', 'View', 'Headers')}>
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
              bytes={response.bytesRead}
              contentType={response.contentType || ''}
              previewMode={response.error ? PREVIEW_MODE_SOURCE : previewMode}
              filter={filter}
              updateFilter={response.error ? null : handleSetFilter}
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
  handleSetFilter: PropTypes.func.isRequired,
  showCookiesModal: PropTypes.func.isRequired,
  handleSetPreviewMode: PropTypes.func.isRequired,
  handleSetActiveResponse: PropTypes.func.isRequired,
  handleDeleteResponses: PropTypes.func.isRequired,

  // Required
  previewMode: PropTypes.string.isRequired,
  filter: PropTypes.string.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  loadStartTime: PropTypes.number.isRequired,
  activeResponseId: PropTypes.string.isRequired,

  // Other
  request: PropTypes.object,
};

export default ResponsePane;
