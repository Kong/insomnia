import { autoBindMethodsForReact } from 'class-autobind-decorator';
import electron, { SaveDialogOptions } from 'electron';
import fs from 'fs';
import mimes from 'mime-types';
import moment from 'moment';
import multiparty from 'multiparty';
import path from 'path';
import React, { PureComponent } from 'react';
import { PassThrough } from 'stream';

import {
  AUTOBIND_CFG,
  getContentTypeFromHeaders,
  PREVIEW_MODE_FRIENDLY,
} from '../../../common/constants';
import type { ResponseHeader } from '../../../models/response';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showModal } from '../modals/index';
import WrapperModal from '../modals/wrapper-modal';
import { ResponseHeadersViewer } from './response-headers-viewer';
import ResponseViewer from './response-viewer';

interface Part {
  name: string;
  bytes: number;
  value: Buffer;
  filename: string | null;
  headers: ResponseHeader[];
}

interface Props {
  download: (...args: any[]) => any;
  responseId: string;
  bodyBuffer: Buffer | null;
  contentType: string;
  disableHtmlPreviewJs: boolean;
  disablePreviewLinks: boolean;
  filter: string;
  filterHistory: string[];
  editorFontSize: number;
  editorIndentSize: number;
  editorKeyMap: string;
  editorLineWrapping: boolean;
  url: string;
}

interface State {
  activePart: number;
  parts: Part[];
  error: string | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class ResponseMultipart extends PureComponent<Props, State> {
  state: State = {
    activePart: -1,
    parts: [],
    error: null,
  };

  componentDidMount() {
    this._setParts();
  }

  async _setParts() {
    try {
      const parts = await this._getParts();
      this.setState({
        parts,
        activePart: 0,
        error: null,
      });
    } catch (err) {
      this.setState({
        error: err.message,
      });
    }
  }

  _describePart(part: Part) {
    const segments = [part.name];

    if (part.filename) {
      segments.push(`(${part.filename})`);
    }

    return segments.join(' ');
  }

  async _handleSelectPart(index: number) {
    this.setState({
      activePart: index,
    });
  }

  _getBody() {
    const { parts, activePart } = this.state;
    const part = parts[activePart];

    if (!part) {
      return Buffer.from('');
    }

    return part.value;
  }

  _handleViewHeaders() {
    const { parts, activePart } = this.state;
    const part = parts[activePart];

    if (!part) {
      return;
    }

    showModal(WrapperModal, {
      title: (
        <span>
          Headers for <code>{part.name}</code>
        </span>
      ),
      body: <ResponseHeadersViewer headers={[...part.headers]} />,
    });
  }

  async _handleSaveAsFile() {
    const { parts, activePart } = this.state;
    const part = parts[activePart];

    if (!part) {
      return;
    }

    const contentType = getContentTypeFromHeaders(part.headers, 'text/plain');
    const extension = mimes.extension(contentType) || '.txt';
    const lastDir = window.localStorage.getItem('insomnia.lastExportPath');
    const dir = lastDir || electron.remote.app.getPath('desktop');
    const date = moment().format('YYYY-MM-DD');
    const filename = part.filename || `${part.name}_${date}`;
    const options: SaveDialogOptions = {
      title: 'Save as File',
      buttonLabel: 'Save',
      defaultPath: path.join(dir, filename),
      filters: [
        // @ts-expect-error https://github.com/electron/electron/pull/29322
        {
          extensions: [extension],
        },
      ],
    };
    const { canceled, filePath } = await electron.remote.dialog.showSaveDialog(options);

    if (canceled) {
      return;
    }

    // Remember last exported path
    window.localStorage.setItem('insomnia.lastExportPath', path.dirname(filename));

    // Save the file
    try {
      // @ts-expect-error -- TSCONVERSION if filePath is undefined, don't try to write anything
      await fs.promises.writeFile(filePath, part.value);
    } catch (err) {
      console.warn('Failed to save multipart to file', err);
    }
  }

  _getParts(): Promise<Part[]> {
    return new Promise((resolve, reject) => {
      const { bodyBuffer, contentType } = this.props;
      const parts: Part[] = [];

      if (!bodyBuffer) {
        return resolve(parts);
      }

      const fakeReq = new PassThrough();
      // @ts-expect-error -- TSCONVERSION investigate `stream` types
      fakeReq.headers = {
        'content-type': contentType,
      };
      const form = new multiparty.Form();
      form.on('part', part => {
        const dataBuffers: any[] = [];
        part.on('data', data => {
          dataBuffers.push(data);
        });
        part.on('error', err => {
          reject(new Error(`Failed to parse part: ${err.message}`));
        });
        part.on('end', () => {
          parts.push({
            value: Buffer.concat(dataBuffers),
            name: part.name,
            filename: part.filename || null,
            bytes: part.byteCount,
            headers: Object.keys(part.headers).map(name => ({
              name,
              value: part.headers[name],
            })),
          });
        });
      });
      form.on('error', err => {
        reject(err);
      });
      form.on('close', () => {
        resolve(parts);
      });
      // @ts-expect-error -- TSCONVERSION
      form.parse(fakeReq);
      fakeReq.write(bodyBuffer);
      fakeReq.end();
    });
  }

  render() {
    const {
      download,
      disableHtmlPreviewJs,
      disablePreviewLinks,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      editorLineWrapping,
      filter,
      filterHistory,
      responseId,
      url,
    } = this.props;
    const { activePart, parts, error } = this.state;

    if (error) {
      return (
        <div
          className="pad monospace"
          style={{
            fontSize: editorFontSize,
          }}
        >
          Failed to parse multipart response: {error}
        </div>
      );
    }

    const selectedPart = parts[activePart];
    return (
      <div
        className="pad-sm tall wide"
        style={{
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr)',
        }}
      >
        <div
          className="pad-bottom-sm"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
          }}
        >
          <div>
            <Dropdown wide>
              <DropdownButton className="btn btn--clicky">
                <div
                  style={{
                    minWidth: '200px',
                    display: 'inline-block',
                  }}
                >
                  {selectedPart ? this._describePart(selectedPart) : 'Unknown'}
                </div>
                <i className="fa fa-caret-down fa--skinny space-left" />
              </DropdownButton>
              {parts.map((part, i) => (
                <DropdownItem key={i} value={i} onClick={this._handleSelectPart}>
                  {i === activePart ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}
                  {this._describePart(part)}
                </DropdownItem>
              ))}
            </Dropdown>
          </div>
          <Dropdown right>
            <DropdownButton className="btn btn--clicky">
              <i className="fa fa-bars" />
            </DropdownButton>
            <DropdownItem onClick={this._handleViewHeaders}>
              <i className="fa fa-list" /> View Headers
            </DropdownItem>
            <DropdownItem onClick={this._handleSaveAsFile}>
              <i className="fa fa-save" /> Save as File
            </DropdownItem>
          </Dropdown>
        </div>
        {selectedPart ? (
          <div className="tall wide">
            <ResponseViewer
              bytes={selectedPart.bytes || 0}
              contentType={getContentTypeFromHeaders(selectedPart.headers, 'text/plain')}
              disableHtmlPreviewJs={disableHtmlPreviewJs}
              disablePreviewLinks={disablePreviewLinks}
              download={download}
              editorFontSize={editorFontSize}
              editorIndentSize={editorIndentSize}
              editorKeyMap={editorKeyMap}
              editorLineWrapping={editorLineWrapping}
              error={null}
              filter={filter}
              filterHistory={filterHistory}
              getBody={this._getBody}
              key={`${responseId}::${activePart}`}
              previewMode={PREVIEW_MODE_FRIENDLY}
              responseId={`${responseId}[${activePart}]`}
              url={url}
            />
          </div>
        ) : null}
      </div>
    );
  }
}

export default ResponseMultipart;
