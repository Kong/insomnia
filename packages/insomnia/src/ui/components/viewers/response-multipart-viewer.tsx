import { format } from 'date-fns';
import type { SaveDialogOptions } from 'electron';
import fs from 'fs';
import { extension as mimeExtension } from 'mime-types';
import multiparty from 'multiparty';
import path from 'path';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { PassThrough } from 'stream';

import {
  getContentTypeFromHeaders,
  PREVIEW_MODE_FRIENDLY,
} from '../../../common/constants';
import type { ResponseHeader } from '../../../models/response';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { showModal } from '../modals/index';
import { WrapperModal } from '../modals/wrapper-modal';
import { ResponseHeadersViewer } from './response-headers-viewer';
import { ResponseViewer } from './response-viewer';

interface Part {
  id: number;
  title: string;
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
  url: string;
}

export const ResponseMultipartViewer: FC<Props> = ({
  download,
  disableHtmlPreviewJs,
  disablePreviewLinks,
  editorFontSize,
  filter,
  filterHistory,
  responseId,
  url,
  bodyBuffer,
  contentType,
}) => {
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const parts = await multipartBufferToArray({ bodyBuffer, contentType });
        setParts(parts);
        setSelectedPart(parts[0]);
      } catch (err) {
        setError(err.message);
      }
    };
    init();
  }, [bodyBuffer, contentType]);

  const selectPart = useCallback((part: Part) => {
    setSelectedPart(part);
  }, []);

  const partBuffer = useCallback(() => selectedPart?.value, [selectedPart]);

  const viewHeaders = useCallback(() => {
    if (!selectedPart) {
      return;
    }
    showModal(WrapperModal, {
      title: (
        <span>
          Headers for <code>{selectedPart.name}</code>
        </span>
      ),
      body: <ResponseHeadersViewer headers={[...selectedPart.headers]} />,
    });
  }, [selectedPart]);

  const saveAsFile = useCallback(async () => {
    if (!selectedPart) {
      return;
    }
    const contentType = getContentTypeFromHeaders(selectedPart.headers, 'text/plain');
    const extension = mimeExtension(contentType) || '.txt';
    const lastDir = window.localStorage.getItem('insomnia.lastExportPath');
    const dir = lastDir || window.app.getPath('desktop');
    const date = format(Date.now(), 'yyyy-MM-dd');
    const filename = selectedPart.filename || `${selectedPart.name}_${date}`;
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
    const { canceled, filePath } = await window.dialog.showSaveDialog(options);

    if (canceled) {
      return;
    }

    // Remember last exported path
    window.localStorage.setItem('insomnia.lastExportPath', path.dirname(filename));

    // Save the file
    try {
      // @ts-expect-error -- TSCONVERSION if filePath is undefined, don't try to write anything
      await fs.promises.writeFile(filePath, selectedPart.value);
    } catch (err) {
      console.warn('Failed to save multipart to file', err);
    }
  }, [selectedPart]);

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

  if (parts.length === 0 || !selectedPart) {
    return null;
  }
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
          <Dropdown
            aria-label='Select Part Dropdown'
            triggerButton={
              <DropdownButton className="btn btn--clicky">
                <div
                  style={{
                    minWidth: '200px',
                    display: 'inline-block',
                  }}
                >
                  {selectedPart.title}
                </div>
                <i className="fa fa-caret-down fa--skinny space-left" />
              </DropdownButton>
            }
          >
            {parts.map(part => (
              <DropdownItem
                aria-label={part.title}
                key={part.id}
              >
                <ItemContent
                  icon={selectedPart?.id === part.id ? 'check' : 'empty'}
                  label={part.title}
                  onClick={() => selectPart(part)}
                />
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
        <Dropdown
          aria-label='Part Actions Dropdown'
          triggerButton={
            <DropdownButton className="btn btn--clicky">
              <i className="fa fa-bars" />
            </DropdownButton>
          }
        >
          <DropdownItem aria-label='View Headers'>
            <ItemContent
              icon="list"
              label="View Headers"
              onClick={viewHeaders}
            />
          </DropdownItem>
          <DropdownItem aria-label='Save as File'>
            <ItemContent
              icon="save"
              label="Save as File"
              onClick={saveAsFile}
            />
          </DropdownItem>
        </Dropdown>
      </div>
      <div className="tall wide">
        <ResponseViewer
          bytes={selectedPart.bytes || 0}
          contentType={getContentTypeFromHeaders(selectedPart.headers, 'text/plain')}
          disableHtmlPreviewJs={disableHtmlPreviewJs}
          disablePreviewLinks={disablePreviewLinks}
          download={download}
          editorFontSize={editorFontSize}
          error={null}
          filter={filter}
          filterHistory={filterHistory}
          getBody={partBuffer}
          key={`${responseId}::${selectedPart?.id}`}
          previewMode={PREVIEW_MODE_FRIENDLY}
          responseId={`${responseId}[${selectedPart?.id}]`}
          url={url}
        />
      </div>

    </div>
  );
};

function multipartBufferToArray({ bodyBuffer, contentType }: { bodyBuffer: Buffer | null; contentType: string }): Promise<Part[]> {
  return new Promise((resolve, reject) => {
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
    let id = 0;
    form.on('part', part => {
      const dataBuffers: any[] = [];
      part.on('data', data => {
        dataBuffers.push(data);
      });
      part.on('error', err => {
        reject(new Error(`Failed to parse part: ${err.message}`));
      });
      part.on('end', () => {
        const title = part.filename ? `${part.name} (${part.filename})` : part.name;
        parts.push({
          id,
          title,
          value: dataBuffers ? Buffer.concat(dataBuffers) : Buffer.from(''),
          name: part.name,
          filename: part.filename || null,
          bytes: part.byteCount,
          headers: Object.keys(part.headers).map(name => ({
            name,
            value: part.headers[name],
          })),
        });
        id += 1;
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
