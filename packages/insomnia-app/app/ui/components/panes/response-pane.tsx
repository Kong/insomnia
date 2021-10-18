import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import { clipboard, remote } from 'electron';
import fs from 'fs';
import { HotKeyRegistry } from 'insomnia-common';
import { json as jsonPrettify } from 'insomnia-prettify';
import mime from 'mime-types';
import React, { PureComponent } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import { AUTOBIND_CFG, PREVIEW_MODE_SOURCE } from '../../../common/constants';
import { exportHarCurrentRequest } from '../../../common/har';
import { getSetCookieHeaders } from '../../../common/misc';
import * as models from '../../../models';
import type { Environment } from '../../../models/environment';
import type { Request } from '../../../models/request';
import type { RequestVersion } from '../../../models/request-version';
import type { Response } from '../../../models/response';
import type { UnitTestResult } from '../../../models/unit-test-result';
import { cancelRequestById } from '../../../network/network';
import { Button } from '../base/button';
import { PreviewModeDropdown } from '../dropdowns/preview-mode-dropdown';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { showError } from '../modals';
import { ResponseTimer } from '../response-timer';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { ResponseCookiesViewer } from '../viewers/response-cookies-viewer';
import { ResponseHeadersViewer } from '../viewers/response-headers-viewer';
import { ResponseTimelineViewer } from '../viewers/response-timeline-viewer';
import { ResponseViewer } from  '../viewers/response-viewer';
import { BlankPane } from './blank-pane';
import { Pane, paneBodyClasses, PaneHeader } from './pane';
import { PlaceholderResponsePane } from './placeholder-response-pane';

interface Props {
  handleSetFilter: (filter: string) => void;
  showCookiesModal: Function;
  handleSetPreviewMode: Function;
  handleSetActiveResponse: Function;
  handleDeleteResponses: Function;
  handleDeleteResponse: Function;
  handleShowRequestSettings: Function;
  previewMode: string;
  filter: string;
  filterHistory: string[];
  disableHtmlPreviewJs: boolean;
  editorFontSize: number;
  editorIndentSize: number;
  editorKeyMap: string;
  editorLineWrapping: boolean;
  loadStartTime: number;
  responses: Response[];
  hotKeyRegistry: HotKeyRegistry;
  disableResponsePreviewLinks: boolean;
  requestVersions: RequestVersion[];
  request?: Request | null;
  response?: Response | null;
  environment?: Environment | null;
  unitTestResult?: UnitTestResult | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ResponsePane extends PureComponent<Props> {
  _responseViewer: ResponseViewer | null = null;

  _setResponseViewerRef(n: ResponseViewer) {
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
    const { canceled, filePath: outputPath } = await remote.dialog.showSaveDialog({
      title: 'Save Response Body',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.${extension}`,
    });

    if (canceled) {
      return;
    }

    const readStream = models.response.getBodyStream(response);
    const dataBuffers: any[] = [];

    if (readStream) {
      readStream.on('data', data => {
        dataBuffers.push(data);
      });
      readStream.on('end', () => {
        // @ts-expect-error -- TSCONVERSION
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

        to.end();
      });
    }
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

    const { canceled, filePath } = await remote.dialog.showSaveDialog({
      title: 'Save Full Response',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.txt`,
    });

    if (canceled) {
      return;
    }

    const readStream = models.response.getBodyStream(response);

    if (readStream) {
      // @ts-expect-error -- TSCONVERSION
      const to = fs.createWriteStream(filePath);
      to.write(headers);
      readStream.pipe(to);
      to.on('error', err => {
        console.warn('Failed to save full response', err);
      });
    }
  }

  async _handleCopyResponseToClipboard() {
    if (!this.props.response) {
      return;
    }

    const bodyBuffer = models.response.getBodyBuffer(this.props.response);
    if (bodyBuffer) {
      clipboard.writeText(bodyBuffer.toString('utf8'));
    }
  }

  async _handleExportAsHAR() {
    const { response, request } = this.props;

    if (!response) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    if (!request) {
      // Should never happen
      console.warn('No request to download');
      return;
    }

    const data = await exportHarCurrentRequest(request, response);
    const har = JSON.stringify(data, null, '\t');

    const { filePath } = await remote.dialog.showSaveDialog({
      title: 'Export As HAR',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.har`,
    });

    if (!filePath) {
      return;
    }

    const to = fs.createWriteStream(filePath);
    to.on('error', err => {
      console.warn('Failed to export har', err);
    });
    to.end(har);
  }

  _handleTabSelect(index: number, lastIndex: number) {
    if (this._responseViewer != null && index === 0 && index !== lastIndex) {
      // Fix for CodeMirror editor not updating its content.
      // Refresh must be called when the editor is visible,
      // so use nextTick to give time for it to be visible.
      process.nextTick(() => {
        // @ts-expect-error -- TSCONVERSION
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

    if (!request) {
      return <BlankPane type="response" />;
    }

    if (!response) {
      return (
        <PlaceholderResponsePane hotKeyRegistry={hotKeyRegistry}>
          <ResponseTimer
            handleCancel={() => cancelRequestById(request._id)}
            loadStartTime={loadStartTime}
          />
        </PlaceholderResponsePane>
      );
    }

    const cookieHeaders = getSetCookieHeaders(response.headers);
    return (
      <Pane type="response">
        {!response ? null : (
          <PaneHeader className="row-spaced">
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
            />
          </PaneHeader>
        )}
        <Tabs
          className={classnames(paneBodyClasses, 'react-tabs')}
          onSelect={this._handleTabSelect}
          forceRenderTabPanel
        >
          <TabList>
            <Tab tabIndex="-1">
              <PreviewModeDropdown
                download={this._handleDownloadResponseBody}
                fullDownload={this._handleDownloadFullResponseBody}
                exportAsHAR={this._handleExportAsHAR}
                previewMode={previewMode}
                updatePreviewMode={handleSetPreviewMode}
                showPrettifyOption={response.contentType.includes('json')}
                copyToClipboard={this._handleCopyResponseToClipboard}
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
              updateFilter={response.error ? undefined : handleSetFilter}
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
          <ResponseTimer
            handleCancel={() => cancelRequestById(request._id)}
            loadStartTime={loadStartTime}
          />
        </ErrorBoundary>
      </Pane>
    );
  }
}
