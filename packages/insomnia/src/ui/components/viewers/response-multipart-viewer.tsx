import { format } from 'date-fns';
import type { SaveDialogOptions } from 'electron';
import { extension as mimeExtension } from 'mime-types';
import React, { type FC, useCallback, useEffect, useState } from 'react';
import { Button } from 'react-aria-components';

import type { Part } from '~/main/multipart-buffer-to-array';

import { getContentTypeFromHeaders, PREVIEW_MODE_FRIENDLY } from '../../../common/constants';
import { Dropdown, DropdownItem, ItemContent } from '../base/dropdown';
import { showModal } from '../modals/index';
import { WrapperModal } from '../modals/wrapper-modal';
import { ResponseHeadersViewer } from './response-headers-viewer';
import { ResponseViewer } from './response-viewer';

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
      if (!bodyBuffer || !contentType) {
        return;
      }
      try {
        const parts = await window.main.multipartBufferToArray({ bodyBuffer, contentType });
        setParts(parts);
        setSelectedPart(parts[0]);
      } catch (err) {
        setError(err.message);
      }
    };
    init();
  }, [bodyBuffer, contentType]);

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
      defaultPath: window.path.join(dir, filename),
      filters: [
        // @ts-expect-error https://github.com/electron/electron/pull/29322
        {
          extensions: [extension],
        },
      ],
    };
    const { canceled, filePath } = await window.dialog.showSaveDialog(options);

    if (canceled || !filePath) {
      return;
    }

    // Remember last exported path
    window.localStorage.setItem('insomnia.lastExportPath', window.path.dirname(filename));

    try {
      await window.main.writeFile({
        path: filePath,
        content: selectedPart.value.toString('utf8'),
      });
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
            aria-label="Select Part Dropdown"
            triggerButton={
              <Button className="h-(--line-height-xs) rounded-md border border-solid border-(--hl-lg) px-(--padding-md) hover:bg-(--hl-xs)">
                <div
                  style={{
                    minWidth: '200px',
                    display: 'inline-block',
                  }}
                >
                  {selectedPart.title}
                </div>
                <i className="fa fa-caret-down fa--skinny space-left" />
              </Button>
            }
          >
            {parts.map(part => (
              <DropdownItem aria-label={part.title} key={part.id}>
                <ItemContent
                  icon={selectedPart?.id === part.id ? 'check' : 'empty'}
                  label={part.title}
                  onClick={() => setSelectedPart(part)}
                />
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
        <Dropdown
          aria-label="Part Actions Dropdown"
          triggerButton={
            <Button className="h-(--line-height-xs) rounded-md border border-solid border-(--hl-lg) px-(--padding-md) hover:bg-(--hl-xs)">
              <i className="fa fa-bars" />
            </Button>
          }
        >
          <DropdownItem aria-label="View Headers">
            <ItemContent icon="list" label="View Headers" onClick={viewHeaders} />
          </DropdownItem>
          <DropdownItem aria-label="Save as File">
            <ItemContent icon="save" label="Save as File" onClick={saveAsFile} />
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
          bodyBuffer={Buffer.from(selectedPart?.value || '')}
          key={`${responseId}::${selectedPart?.id}`}
          previewMode={PREVIEW_MODE_FRIENDLY}
          responseId={`${responseId}[${selectedPart?.id}]`}
          url={url}
        />
      </div>
    </div>
  );
};
