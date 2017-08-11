// @flow
import type {Request} from '../../models/request';
import type {Response} from '../../models/response';

import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import fs from 'fs';
import mime from 'mime-types';
import {remote} from 'electron';
import {Tab, TabList, TabPanel, Tabs} from 'react-tabs';
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
import {PREVIEW_MODE_SOURCE} from '../../common/constants';
import {getSetCookieHeaders, nullFn} from '../../common/misc';
import {cancelCurrentRequest} from '../../network/network';
import {trackEvent} from '../../analytics';
import Hotkey from './hotkey';

@autobind
class ResponsePane extends PureComponent {
  props: {
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
    responses: Array<Object>,

    // Other
    request: ?Request,
    response: ?Response
  };

  _handleGetResponseBody (): Buffer | null {
    if (!this.props.response) {
      return null;
    }

    return models.response.getBodyBuffer(this.props.response);
  }

  async _handleDownloadResponseBody () {
    if (!this.props.response) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    const {response} = this.props;
    const {contentType} = response;
    const extension = mime.extension(contentType) || '';

    const options = {
      title: 'Save Response Body',
      buttonLabel: 'Save',
      filters: [{
        name: 'Download', extensions: [extension]
      }]
    };

    remote.dialog.showSaveDialog(options, outputPath => {
      if (!outputPath) {
        trackEvent('Response', 'Save Cancel');
        return;
      }

      const bodyBuffer = models.response.getBodyBuffer(response);

      if (bodyBuffer) {
        fs.writeFile(outputPath, bodyBuffer, err => {
          if (err) {
            console.warn('Failed to save response body', err);
            trackEvent('Response', 'Save Failure');
          } else {
            trackEvent('Response', 'Save Success');
          }
        });
      }
    });
  }

  _handleDownloadFullResponseBody () {
    const {response} = this.props;

    if (!response) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    const headers = response.timeline
      .filter(v => v.name === 'HEADER_IN')
      .map(v => v.value)
      .join('');

    const bodyBuffer = models.response.getBodyBuffer(response) || Buffer.from('');
    const fullResponse = `${headers}${bodyBuffer.toString()}`;

    const options = {
      title: 'Save Full Response',
      buttonLabel: 'Save',
      filters: [{
        name: 'Download'
      }]
    };

    remote.dialog.showSaveDialog(options, filename => {
      if (!filename) {
        trackEvent('Response', 'Save Full Cancel');
        return;
      }

      fs.writeFile(filename, fullResponse, {}, err => {
        if (err) {
          console.warn('Failed to save full response', err);
          trackEvent('Response', 'Save Full Failure');
        } else {
          trackEvent('Response', 'Save Full Success');
        }
      });
    });
  }

  render () {
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
                    <code><Hotkey char="Enter"/></code>
                  </td>
                </tr>
                <tr>
                  <td>Focus Url Bar</td>
                  <td className="text-right">
                    <code><Hotkey char="L"/></code>
                  </td>
                </tr>
                <tr>
                  <td>Manage Cookies</td>
                  <td className="text-right">
                    <code><Hotkey char="K"/></code>
                  </td>
                </tr>
                <tr>
                  <td>Edit Environments</td>
                  <td className="text-right">
                    <code><Hotkey char="E"/></code>
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
              <SizeTag bytesRead={response.bytesRead} bytesContent={response.bytesContent}/>
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
        <Tabs className="react-tabs pane__body" forceRenderTabPanel>
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
                Header
                {' '}
                {response.headers.length > 0 && (
                  <span className="bubble">{response.headers.length}</span>
                )}
              </Button>
            </Tab>
            <Tab>
              <Button>
                Cookie {cookieHeaders.length ? (
                <span className="bubble">{cookieHeaders.length}</span>) : null}
              </Button>
            </Tab>
            <Tab>
              <Button>Timeline</Button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel">
            <ResponseViewer
              key={response._id}
              // Send larger one because legacy responses have bytesContent === -1
              bytes={Math.max(response.bytesContent, response.bytesRead)}
              contentType={response.contentType || ''}
              previewMode={response.error ? PREVIEW_MODE_SOURCE : previewMode}
              filter={filter}
              filterHistory={filterHistory}
              updateFilter={response.error ? null : handleSetFilter}
              bodyPath={response.bodyPath}
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
              <ResponseHeadersViewer
                key={response._id}
                headers={response.headers}
              />
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel scrollable-container">
            <div className="scrollable pad">
              <ResponseCookiesViewer
                handleShowRequestSettings={handleShowRequestSettings}
                cookiesSent={response.settingSendCookies}
                cookiesStored={response.settingStoreCookies}
                showCookiesModal={showCookiesModal}
                key={response._id}
                headers={cookieHeaders}
              />
            </div>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel">
            <ResponseTimelineViewer
              key={response._id}
              timeline={response.timeline || []}
              editorLineWrapping={editorLineWrapping}
              editorFontSize={editorFontSize}
              editorIndentSize={editorIndentSize}
            />
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

export default ResponsePane;
