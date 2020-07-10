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
import { getSetCookieHeaders } from '../../common/misc';
import { cancelCurrentRequest } from '../../network/network';
import Hotkey from './hotkey';
import ErrorBoundary from './error-boundary';
import type { HotKeyRegistry } from '../../common/hotkeys';
import { hotKeyRefs } from '../../common/hotkeys';
import type { RequestVersion } from '../../models/request-version';
import { showError } from '../components/modals/index';
import { json as jsonPrettify } from 'insomnia-prettify';
import type { Environment } from '../../models/environment';
import type { UnitTestResult } from '../../models/unit-test-result';

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
  disableHtmlPreviewJs: boolean,
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  loadStartTime: number,
  responses: Array<Response>,
  hotKeyRegistry: HotKeyRegistry,
  disableResponsePreviewLinks: boolean,

  // Other
  requestVersions: Array<RequestVersion>,
  request: ?Request,
  response: ?Response,
  environment: ?Environment,
  unitTestResult: ?UnitTestResult,
};

@autobind
class ResponsePane extends React.PureComponent<Props> {
  _responseViewer: any;

  _setResponseViewerRef(n: any) {
    this._responseViewer = n;
  }

  _handleGetResponseBody(): Buffer | null {
    if (!this.props.response) {
      return null;
    }

    return models.response.getBodyBuffer(this.props.response);
  }

  async _handleDownloadResponseBody(prettify: boolean) {
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
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.${extension}`,
    };

    remote.dialog.showSaveDialog(options, outputPath => {
      if (!outputPath) {
        return;
      }

      const readStream = models.response.getBodyStream(response);
      const dataBuffers = [];
      if (readStream) {
        readStream.on('data', data => {
          dataBuffers.push(data);
        });
        readStream.on('end', () => {
          const to = fs.createWriteStream(outputPath);
          const finalBuffer = Buffer.concat(dataBuffers);

          to.on('error', err => {
            showError({
              title: 'Save Failed',
              message: 'Failed to save response body',
              error: err,
            });
          });

          if (prettify && contentType.includes('json')) {
            to.write(jsonPrettify(finalBuffer.toString('utf8')));
          } else {
            to.write(finalBuffer);
          }
        });
      }
    });
  }

  async _handleDownloadFullResponseBody() {
    const { response, request } = this.props;

    if (!response || !request) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    const timeline = await models.response.getTimeline(response);
    const headers = timeline
      .filter(v => v.name === 'HEADER_IN')
      .map(v => v.value)
      .join('');

    const options = {
      title: 'Save Full Response',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.txt`,
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

  _handleTabSelect(index: number, lastIndex: number) {
    if (this._responseViewer != null && index === 0 && index !== lastIndex) {
      // Fix for CodeMirror editor not updating its content.
      // Refresh must be called when the editor is visible,
      // so use nextTick to give time for it to be visible.
      process.nextTick(() => {
        this._responseViewer.refresh();
      });
    }
  }

  render() {
    const {
      disableHtmlPreviewJs,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      editorLineWrapping,
      environment,
      filter,
      disableResponsePreviewLinks,
      filterHistory,
      handleDeleteResponse,
      handleDeleteResponses,
      handleSetActiveResponse,
      handleSetFilter,
      handleSetPreviewMode,
      handleShowRequestSettings,
      hotKeyRegistry,
      loadStartTime,
      previewMode,
      request,
      requestVersions,
      response,
      responses,
      showCookiesModal,
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
                        <Hotkey
                          keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SEND.id]}
                          useFallbackMessage
                        />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Focus Url Bar</td>
                    <td className="text-right">
                      <code>
                        <Hotkey
                          keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_FOCUS_URL.id]}
                          useFallbackMessage
                        />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Manage Cookies</td>
                    <td className="text-right">
                      <code>
                        <Hotkey
                          keyBindings={hotKeyRegistry[hotKeyRefs.SHOW_COOKIES_EDITOR.id]}
                          useFallbackMessage
                        />
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td>Edit Environments</td>
                    <td className="text-right">
                      <code>
                        <Hotkey
                          keyBindings={hotKeyRegistry[hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id]}
                          useFallbackMessage
                        />
                      </code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <ResponseTimer handleCancel={cancelCurrentRequest} loadStartTime={loadStartTime} />
        </section>
      );
    }

    const cookieHeaders = getSetCookieHeaders(response.headers);

    return (
      <section className={paneClasses}>
        {!response ? null : (
          <header className={paneHeaderClasses + ' row-spaced'}>
            <div className="no-wrap scrollable scrollable--no-bars pad-left">
              <StatusTag statusCode={response.statusCode} statusMessage={response.statusMessage} />
              <TimeTag milliseconds={response.elapsedTime} />
              <SizeTag bytesRead={response.bytesRead} bytesContent={response.bytesContent} />
            </div>
            <ResponseHistoryDropdown
              activeResponse={response}
              activeEnvironment={environment}
              responses={responses}
              requestVersions={requestVersions}
              requestId={request._id}
              handleSetActiveResponse={handleSetActiveResponse}
              handleDeleteResponses={handleDeleteResponses}
              handleDeleteResponse={handleDeleteResponse}
              className="tall pane__header__right"
              right
            />
          </header>
        )}
        <Tabs
          className={paneBodyClasses + ' react-tabs'}
          onSelect={this._handleTabSelect}
          forceRenderTabPanel>
          <TabList>
            <Tab tabIndex="-1">
              <PreviewModeDropdown
                download={this._handleDownloadResponseBody}
                fullDownload={this._handleDownloadFullResponseBody}
                previewMode={previewMode}
                updatePreviewMode={handleSetPreviewMode}
                showPrettifyOption={response.contentType.includes('json')}
              />
            </Tab>
            <Tab tabIndex="-1">
              <Button>
                Header{' '}
                {response.headers.length > 0 && (
                  <span className="bubble">{response.headers.length}</span>
                )}
              </Button>
            </Tab>
            <Tab tabIndex="-1">
              <Button>
                Cookie{' '}
                {cookieHeaders.length ? (
                  <span className="bubble">{cookieHeaders.length}</span>
                ) : null}
              </Button>
            </Tab>
            <Tab tabIndex="-1">
              <Button>Timeline</Button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel">
            <ResponseViewer
              ref={this._setResponseViewerRef}
              bytes={Math.max(response.bytesContent, response.bytesRead)}
              contentType={response.contentType || ''}
              disableHtmlPreviewJs={disableHtmlPreviewJs}
              disablePreviewLinks={disableResponsePreviewLinks}
              download={this._handleDownloadResponseBody}
              editorFontSize={editorFontSize}
              editorIndentSize={editorIndentSize}
              editorKeyMap={editorKeyMap}
              editorLineWrapping={editorLineWrapping}
              error={response.error}
              filter={filter}
              filterHistory={filterHistory}
              getBody={this._handleGetResponseBody}
              previewMode={response.error ? PREVIEW_MODE_SOURCE : previewMode}
              responseId={response._id}
              updateFilter={response.error ? null : handleSetFilter}
              url={response.url}
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable pad">
              <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
                <ResponseHeadersViewer headers={response.headers} />
              </ErrorBoundary>
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable pad">
              <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
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
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseTimelineViewer
                response={response}
                editorLineWrapping={editorLineWrapping}
                editorFontSize={editorFontSize}
                editorIndentSize={editorIndentSize}
              />
            </ErrorBoundary>
          </TabPanel>
        </Tabs>
        <ErrorBoundary errorClassName="font-error pad text-center">
          <ResponseTimer handleCancel={cancelCurrentRequest} loadStartTime={loadStartTime} />
        </ErrorBoundary>
      </section>
    );
  }
}

export default ResponsePane;
