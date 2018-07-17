// @flow
import type { Request } from '../../models/request';
import type { Response } from '../../models/response';

import * as React from 'react';
import autobind from 'autobind-decorator';
import fs from 'fs';
import mime from 'mime-types';
import { remote } from 'electron';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import SizeTag from './tags/size-tag';
import StatusTag from './tags/status-tag';
import TimeTag from './tags/time-tag';
import Button from './base/button';
import PreviewModeDropdown from './dropdowns/preview-mode-dropdown';
import ResponseViewer from './viewers/response-viewer';
import ResponseHistoryDropdown from './dropdowns/response-history-dropdown';
import ResponseTimer from './response-timer';
import ResponseTimelineViewer from './viewers/response-timeline-viewer';
import ResponseHeadersViewer from './viewers/response-headers-viewer';
import ResponseCookiesViewer from './viewers/response-cookies-viewer';
import * as models from '../../models';
import { PREVIEW_MODE_SOURCE } from '../../common/constants';
import { getSetCookieHeaders, nullFn } from '../../common/misc';
import { cancelCurrentRequest } from '../../network/network';
import Hotkey from './hotkey';
import * as hotkeys from '../../common/hotkeys';
import ErrorBoundary from './error-boundary';

type Props = {
  // Functions
  handleSetFilter: Function,
  showCookiesModal: Function,
  handleSetPreviewMode: Function,
  handleSetActiveResponse: Function,
  handleDeleteResponses: Function,
  handleDeleteResponse: Function,
  handleShowRequestSettings: Function,

  // Required
  previewMode: string,
  filter: string,
  filterHistory: Array<string>,
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  loadStartTime: number,
  responses: Array<Response>,

  // Other
  request: ?Request,
  response: ?Response
};

@autobind
class ResponsePane extends React.PureComponent<Props> {
  _handleGetResponseBody(): Buffer | null {
    if (!this.props.response) {
      return null;
    }

    return models.response.getBodyBuffer(this.props.response);
  }

  async _handleDownloadResponseBody() {
    const { response, request } = this.props;
    if (!response || !request) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    const { contentType } = response;
    const extension = mime.extension(contentType) || 'unknown';

    const options = {
      title: 'Save Response Body',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(
        / +/g,
        '_'
      )}-${Date.now()}.${extension}`
    };

    remote.dialog.showSaveDialog(options, outputPath => {
      if (!outputPath) {
        return;
      }

      const readStream = models.response.getBodyStream(response);
      if (readStream) {
        const to = fs.createWriteStream(outputPath);
        readStream.pipe(to);
        to.on('error', err => {
          console.warn('Failed to save response body', err);
        });
      }
    });
  }

  _handleDownloadFullResponseBody() {
    const { response, request } = this.props;

    if (!response || !request) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    const headers = response.timeline
      .filter(v => v.name === 'HEADER_IN')
      .map(v => v.value)
      .join('');

    const options = {
      title: 'Save Full Response',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.txt`
    };

    remote.dialog.showSaveDialog(options, filename => {
      if (!filename) {
        return;
      }

      const readStream = models.response.getBodyStream(response);
      if (readStream) {
        const to = fs.createWriteStream(filename);
        to.write(headers);
        readStream.pipe(to);
        to.on('error', err => {
          console.warn('Failed to save full response', err);
        });
      }
    });
  }

  render() {
    const {
      request,
      responses,
      response,
      previewMode,
      handleShowRequestSettings,
      handleSetPreviewMode,
      handleSetActiveResponse,
      handleDeleteResponses,
      handleDeleteResponse,
      handleSetFilter,
      loadStartTime,
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      filter,
      filterHistory,
      showCookiesModal
    } = this.props;

    const paneClasses = 'response-pane theme--pane pane';
    const paneHeaderClasses = 'pane__header theme--pane__header';
    const paneBodyClasses = 'pane__body theme--pane__body';

    if (!request) {
      return (
        <section className={paneClasses}>
          <header className={paneHeaderClasses} />
          <div className={paneBodyClasses + ' pane__body--placeholder'} />
        </section>
      );
    }

    if (!response) {
      return (
        <section className={paneClasses}>
          <header className={paneHeaderClasses} />
          <div className={paneBodyClasses + ' pane__body--placeholder'}>
            <div>
              <table className="table--fancy">
                <tbody>
                  <tr>
                    <td>Send Request</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.SEND_REQUEST} />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Focus Url Bar</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.FOCUS_URL} />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Manage Cookies</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.SHOW_COOKIES} />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Edit Environments</td>
                    <td className="text-right">
                      <code>
                        <Hotkey hotkey={hotkeys.SHOW_ENVIRONMENTS} />
                      </code>
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
      <section className={paneClasses}>
        {!response ? null : (
          <header className={paneHeaderClasses + ' row-spaced'}>
            <div className="no-wrap scrollable scrollable--no-bars pad-left">
              <StatusTag
                statusCode={response.statusCode}
                statusMessage={response.statusMessage}
              />
              <TimeTag milliseconds={response.elapsedTime} />
              <SizeTag
                bytesRead={response.bytesRead}
                bytesContent={response.bytesContent}
              />
            </div>
            <ResponseHistoryDropdown
              activeResponse={response}
              responses={responses}
              requestId={request._id}
              handleSetActiveResponse={handleSetActiveResponse}
              handleDeleteResponses={handleDeleteResponses}
              handleDeleteResponse={handleDeleteResponse}
              onChange={nullFn}
              className="tall pane__header__right"
              right
            />
          </header>
        )}
        <Tabs className={paneBodyClasses + ' react-tabs'} forceRenderTabPanel>
          <TabList>
            <Tab>
              <PreviewModeDropdown
                download={this._handleDownloadResponseBody}
                fullDownload={this._handleDownloadFullResponseBody}
                previewMode={previewMode}
                updatePreviewMode={handleSetPreviewMode}
              />
            </Tab>
            <Tab>
              <Button>
                Header{' '}
                {response.headers.length > 0 && (
                  <span className="bubble">{response.headers.length}</span>
                )}
              </Button>
            </Tab>
            <Tab>
              <Button>
                Cookie{' '}
                {cookieHeaders.length ? (
                  <span className="bubble">{cookieHeaders.length}</span>
                ) : null}
              </Button>
            </Tab>
            <Tab>
              <Button>Timeline</Button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel">
            <ResponseViewer
              // Send larger one because legacy responses have bytesContent === -1
              responseId={response._id}
              bytes={Math.max(response.bytesContent, response.bytesRead)}
              contentType={response.contentType || ''}
              previewMode={response.error ? PREVIEW_MODE_SOURCE : previewMode}
              filter={filter}
              filterHistory={filterHistory}
              updateFilter={response.error ? null : handleSetFilter}
              download={this._handleDownloadResponseBody}
              getBody={this._handleGetResponseBody}
              error={response.error}
              editorLineWrapping={editorLineWrapping}
              editorFontSize={editorFontSize}
              editorIndentSize={editorIndentSize}
              editorKeyMap={editorKeyMap}
              url={response.url}
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable pad">
              <ErrorBoundary
                key={response._id}
                errorClassName="font-error pad text-center">
                <ResponseHeadersViewer headers={response.headers} />
              </ErrorBoundary>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable pad">
              <ErrorBoundary
                key={response._id}
                errorClassName="font-error pad text-center">
                <ResponseCookiesViewer
                  handleShowRequestSettings={handleShowRequestSettings}
                  cookiesSent={response.settingSendCookies}
                  cookiesStored={response.settingStoreCookies}
                  showCookiesModal={showCookiesModal}
                  headers={cookieHeaders}
                />
              </ErrorBoundary>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel">
            <ErrorBoundary
              key={response._id}
              errorClassName="font-error pad text-center">
              <ResponseTimelineViewer
                timeline={response.timeline || []}
                editorLineWrapping={editorLineWrapping}
                editorFontSize={editorFontSize}
                editorIndentSize={editorIndentSize}
              />
            </ErrorBoundary>
          </TabPanel>
        </Tabs>
        <ErrorBoundary errorClassName="font-error pad text-center">
          <ResponseTimer
            handleCancel={cancelCurrentRequest}
            loadStartTime={loadStartTime}
          />
        </ErrorBoundary>
      </section>
    );
  }
}

export default ResponsePane;
