import React, { useEffect, useState } from 'react';
import {
  Button,
  Cell,
  Column,
  Dialog,
  FileTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Row,
  Table,
  TableBody,
  TableHeader,
} from 'react-aria-components';

import { EncodingPicker } from '../encoding-picker';
import { Icon } from '../icon';

export type UploadDataType = Record<string, any>;
export interface UploadDataModalProps {
  onUploadFile: (file: File | null, data: UploadDataType[]) => void;
  onClose: () => void;
  userUploadData: UploadDataType[];
}

const rowHeaderStyle =
  'sticky normal-case top-[-8px] p-2 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none';
const rowCellStyle =
  'whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none';
const supportedFileTypes = ['application/json', 'text/csv'];

export const genPreviewTableData = (uploadData: UploadDataType[]) => {
  // generate header and body data for preview table from upload data
  let dataHeaders: string[] = [];
  const filteredUploadData: UploadDataType[] = uploadData.filter(data => {
    const isObjectData = data && typeof data === 'object' && !Array.isArray(data) && data !== null;
    if (isObjectData) {
      dataHeaders = dataHeaders.concat(Object.keys(data));
    }
    return isObjectData;
  });
  // dedup data headers
  const uniqueDataHeaders = [...new Set(dataHeaders)];
  return { data: filteredUploadData, headers: uniqueDataHeaders };
};

export const UploadDataModal = ({ onUploadFile, onClose, userUploadData }: UploadDataModalProps) => {
  const [file, setUploadFile] = useState<File | null>(null);
  const [uploadDataHeaders, setUploadDataHeaders] = useState<string[]>([]);
  const [uploadData, setUploadData] = useState<UploadDataType[]>([]);
  const [fileEncoding, setFileEncoding] = useState('');
  const [invalidFileReason, setInvalidFileReason] = useState('');

  const parseFileContent = (content: string, fileType: string) => {
    try {
      if (fileType === 'application/json') {
        try {
          const jsonDataContent = JSON.parse(content);
          if (Array.isArray(jsonDataContent)) {
            const { data, headers } = genPreviewTableData(jsonDataContent);
            if (headers.length > 0 && data.length > 0) {
              setUploadDataHeaders(headers);
              setUploadData(data);
            } else {
              setInvalidFileReason('Invalid JSON file uploaded, JSON file do not contain any key-value pair.');
            }
          } else {
            setInvalidFileReason('Invalid JSON file uploaded, JSON file must be array of key-value pairs.');
          }
        } catch (error) {
          setInvalidFileReason('Upload JSON file can not be parsed');
        }
      } else if (fileType === 'text/csv') {
        // Replace CRLF (Windows line break) and CR (Mac link break) with \n, then split into csv arrays
        const csvRows = content
          .replace(/\r\n|\r/g, '\n')
          .split('\n')
          .map(row => row.split(','));
        // at least 2 rows required for csv
        if (csvRows.length > 1) {
          const csvHeaders = csvRows[0];
          const csvContentRows = csvRows.slice(1);
          const uploadData = csvContentRows.map(contentRow =>
            csvHeaders.reduce((acc: UploadDataType, cur, idx) => {
              acc[cur] = contentRow[idx] ?? '';
              return acc;
            }, {}),
          );
          setUploadDataHeaders(csvHeaders);
          setUploadData(uploadData);
        } else {
          setInvalidFileReason('CSV file must contain at least two rows with first row as variable names');
        }
      }
    } catch (error) {
      setInvalidFileReason(`Failed to read file ${error?.message}`);
    }
  };

  const handleFileSelect = async (fileList: FileList | null) => {
    setInvalidFileReason('');
    setUploadData([]);
    if (!fileList) {
      return;
    }
    const files = Array.from(fileList);
    const file = files[0];
    const fileType = file.type;
    if (!supportedFileTypes.includes(fileType)) {
      setInvalidFileReason(`Uploaded file is unsupported ${file.type}`);
      return;
    }
    const filePath = window.webUtils.getPathForFile(file);
    try {
      const { content, encoding } = await window.main.insecureReadFileWithEncoding({ path: filePath });
      setFileEncoding(encoding);
      parseFileContent(content, fileType);
    } catch (error) {
      setInvalidFileReason(`Failed to read file ${error?.message}`);
      return;
    }
    setUploadFile(file);
  };

  const handleEncodingChange = async (newEncoding: string) => {
    setFileEncoding(newEncoding);
    setInvalidFileReason('');
    if (file) {
      const filePath = window.webUtils.getPathForFile(file);
      const fileType = file.type;
      try {
        const { content } = await window.main.insecureReadFileWithEncoding({
          path: filePath,
          encoding: newEncoding,
        });
        parseFileContent(content, fileType);
      } catch (error) {
        setInvalidFileReason(`Failed to read file ${error?.message}`);
      }
    }
  };

  const handleUploadData = () => {
    if (file && uploadData.length >= 1) {
      onUploadFile(file, uploadData);
    }
    onClose();
  };

  const handleClearData = () => {
    onUploadFile(null, []);
    onClose();
  };

  useEffect(() => {
    if (userUploadData.length > 0) {
      const { data, headers } = genPreviewTableData(userUploadData);
      setUploadDataHeaders(headers);
      setUploadData(data);
    }
  }, [userUploadData]);

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-start justify-center bg-black/30"
    >
      <Modal
        className="m-24 flex max-h-[75%] w-full max-w-3xl flex-col overflow-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  {userUploadData.length > 0 ? 'Update Data' : 'Preview Data'}
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex w-full shrink-0 grow basis-12 select-none flex-col gap-6 overflow-hidden overflow-y-auto rounded">
                <FileTrigger allowsMultiple={false} onSelect={handleFileSelect} acceptedFileTypes={['.csv', '.json']}>
                  <Button className="flex flex-1 flex-shrink-0 items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-sm] px-2 py-1 text-base text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm]">
                    <Icon icon="upload" />
                    <span>{uploadData.length > 0 ? 'Change Data File' : 'Select Data File'}</span>
                  </Button>
                </FileTrigger>
              </div>
              {file && uploadData.length > 0 && (
                <div>
                  <span className="mr-4">File Encoding</span>
                  <EncodingPicker encoding={fileEncoding} onChange={handleEncodingChange} />
                </div>
              )}
              {invalidFileReason !== '' && (
                <div className="notice error margin-top-sm">
                  <p>{invalidFileReason}</p>
                </div>
              )}
              {uploadData.length > 0 && (
                <div className="flex-1 overflow-auto py-2">
                  <Heading className="margin-bottom-sm text-xl">Data Preview</Heading>
                  <Table aria-label="Data Preview Table" className="min-w-full table-auto">
                    <TableHeader>
                      <Column isRowHeader className={rowHeaderStyle}>
                        Iteration
                      </Column>
                      {uploadDataHeaders.map((header, idx) => (
                        <Column
                          // eslint-disable-next-line react/no-array-index-key
                          key={`${header}-${idx}`}
                          className={rowHeaderStyle}
                        >
                          {header}
                        </Column>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {uploadData.map((rowData, idx) => {
                        return (
                          // eslint-disable-next-line react/no-array-index-key
                          <Row key={idx}>
                            <Cell className={rowCellStyle}>
                              <span className="p-2">{idx + 1}</span>
                            </Cell>
                            {uploadDataHeaders.map(rowKey => (
                              <Cell
                                className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none"
                                key={rowKey}
                              >
                                <span className="p-2">
                                  {typeof rowData[rowKey] === 'string'
                                    ? rowData[rowKey]
                                    : JSON.stringify(rowData[rowKey])}
                                </span>
                              </Cell>
                            ))}
                          </Row>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="mt-2 flex justify-end">
                {userUploadData.length > 0 && (
                  <Button
                    className="flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--hl] transition-colors hover:bg-opacity-90 hover:no-underline"
                    onPress={handleClearData}
                  >
                    Remove Data
                  </Button>
                )}
                <Button
                  isDisabled={uploadData.length < 1}
                  className="ml-4 flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline"
                  onPress={handleUploadData}
                >
                  Upload
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
