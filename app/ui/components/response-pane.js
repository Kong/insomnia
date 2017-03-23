import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import fs from 'fs';
import mime from 'mime-types';
import {remote} from 'electron';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import SizeTag from './tags/size-tag';
import StatusTag from './tags/status-tag';
import TimeTag from './tags/time-tag';
import Button from './base/button';
import PreviewModeDropdown from './dropdowns/preview-mode-dropdown';
import ResponseViewer from './viewers/response-viewer';
import ResponseHistoryDropdown from './dropdowns/response-history-dropdown';
import ResponseTimer from './response-timer';
import ResponseHeadersViewer from './viewers/response-headers-viewer';
import ResponseCookiesViewer from './viewers/response-cookies-viewer';
import * as models from '../../models';
import {MOD_SYM, PREVIEW_MODE_SOURCE, getPreviewModeName} from '../../common/constants';
import {getSetCookieHeaders, nullFn} from '../../common/misc';
import {cancelCurrentRequest} from '../../network/network';
import {trackEvent} from '../../analytics';

@autobind
class ResponsePane extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      response: null
    };
  }

  _trackTab (name) {
    trackEvent('Response Pane', 'View', name);
  }

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
        name: 'Download', extensions: [extension]
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
      editorKeyMap,
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
      );
    }

    if (!response) {
      return (
        <section className="response-pane pane">
          <header className="pane__header"></header>
          <div className="pane__body pane__body--placeholder">
            <div>
              <table className="table--fancy">
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

          <ResponseTimer
            handleCancel={cancelCurrentRequest}
            loadStartTime={loadStartTime}
          />
        </section>
      );
    }

    const cookieHeaders = getSetCookieHeaders(response.headers);

    return (
      <section className="response-pane pane">
        {!response ? null : (
            <header className="pane__header row-spaced">
              <div className="no-wrap scrollable scrollable--no-bars pad-left">
                <StatusTag
                  statusCode={response.statusCode}
                  statusMessage={response.statusMessage || null}
                />
                <TimeTag milliseconds={response.elapsedTime}/>
                <SizeTag bytes={response.bytesRead}/>
              </div>
              <ResponseHistoryDropdown
                requestId={request._id}
                isLatestResponseActive={!activeResponseId}
                activeResponseId={response._id}
                handleSetActiveResponse={handleSetActiveResponse}
                handleDeleteResponses={handleDeleteResponses}
                onChange={nullFn}
                className="tall pane__header__right"
                right
              />
            </header>
          )}
        <Tabs className="pane__body" forceRenderTabPanel>
          <TabList>
            <Tab>
              <Button onClick={this._trackTab} value="Response">
                {getPreviewModeName(previewMode)}
              </Button>
              <PreviewModeDropdown
                download={this._handleDownloadResponseBody}
                previewMode={previewMode}
                updatePreviewMode={handleSetPreviewMode}
              />
            </Tab>
            <Tab>
              <Button onClick={this._trackTab} value="Cookies">
                Cookies {cookieHeaders.length ? (
                  <span className="txt-sm">
                    ({cookieHeaders.length})
                  </span>
                ) : null}
              </Button>
            </Tab>
            <Tab>
              <Button onClick={this._trackTab} value="Headers">
                Headers {response.headers.length ? (
                  <span className="txt-sm">
                  ({response.headers.length})
                </span>
                ) : null}
              </Button>
            </Tab>
          </TabList>
          <TabPanel>
            <ResponseViewer
              key={response._id}
              bytes={response.bytesRead}
              contentType={response.contentType || ''}
              previewMode={response.error ? PREVIEW_MODE_SOURCE : previewMode}
              statusCode={response.statusCode}
              filter={filter}
              updateFilter={response.error ? null : handleSetFilter}
              body={response.error ? response.error : response.body}
              encoding={response.encoding}
              error={!!response.error}
              responseId={response._id}
              editorLineWrapping={editorLineWrapping}
              editorFontSize={editorFontSize}
              editorKeyMap={editorKeyMap}
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
        <ResponseTimer
          handleCancel={cancelCurrentRequest}
          loadStartTime={loadStartTime}
        />
      </section>
    );
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
  editorKeyMap: PropTypes.string.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  loadStartTime: PropTypes.number.isRequired,
  activeResponseId: PropTypes.string.isRequired,

  // Other
  request: PropTypes.object
};

export default ResponsePane;
