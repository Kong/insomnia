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

import { Icon } from '../icon';

export type UploadDataType = Record<string, any>;
export interface UploadDataModalProps {
  onUploadFile: (file: File | null, data: UploadDataType[]) => void;
  onClose: () => void;
  userUploadData: UploadDataType[];
}

const rowHeaderStyle = 'sticky normal-case top-[-8px] p-2 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none';
const rowCellStyle = 'whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none';

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
  const [invalidFileReason, setInvalidFileReason] = useState('');

  const handleFileSelect = (fileList: FileList | null) => {
    setInvalidFileReason('');
    setUploadData([]);
    if (!fileList) {
      return;
    };
    const files = Array.from(fileList);
    const file = files[0];
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const content = e.target?.result as string;
      if (file.type === 'application/json') {
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
      } else if (file.type === 'text/csv') {
        // Replace CRLF (Windows line break) and CR (Mac link break) with \n, then split into csv arrays
        const csvRows = content.replace(/\r\n|\r/g, '\n').split('\n').map(row => row.split(','));
        // at least 2 rows required for csv
        if (csvRows.length > 1) {
          const csvHeaders = csvRows[0];
          const csvContentRows = csvRows.slice(1, csvRows.length);
          const uploadData = csvContentRows.map(contentRow => csvHeaders.reduce((acc: UploadDataType, cur, idx) => {
            acc[cur] = contentRow[idx] ?? '';
            return acc;
          }, {}));
          setUploadDataHeaders(csvHeaders);
          setUploadData(uploadData);
        } else {
          setInvalidFileReason('CSV file must contain at least two rows with first row as variable names');
        }
      } else {
        setInvalidFileReason(`Uploaded file is unsupported ${file.type}`);
      }
    };
    reader.onerror = () => {
      setInvalidFileReason(`Failed to read file ${reader.error?.message}`);
    };
    reader.readAsText(file);
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
    };
  }, [userUploadData]);

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-start justify-center bg-black/30"
    >
      <Modal
        className="max-h-[75%] overflow-auto flex flex-col w-full max-w-3xl rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font] m-24"
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>{userUploadData.length > 0 ? 'Update Data' : 'Preview Data'}</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='rounded grow shrink-0 w-full overflow-hidden basis-12 flex flex-col gap-6 select-none overflow-y-auto'>
                <FileTrigger
                  allowsMultiple={false}
                  onSelect={handleFileSelect}
                  acceptedFileTypes={['.csv', '.json']}
                >
                  <Button className="flex flex-1 flex-shrink-0 border-solid border border-[--hl-`sm] py-1 gap-2 items-center justify-center px-2 aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent transition-all text-base">
                    <Icon icon="upload" />
                    <span>{uploadData.length > 0 ? 'Change Data File' : 'Select Data File'}</span>
                  </Button>
                </FileTrigger>
              </div>
              {invalidFileReason !== '' &&
                <div className="notice error margin-top-sm">
                  <p>{invalidFileReason}</p>
                </div>
              }
              {uploadData.length > 0 &&
                <div className='overflow-auto py-2 flex-1'>
                  <Heading className='text-xl margin-bottom-sm'>Data Preview</Heading>
                  <Table
                    aria-label='Data Preview Table'
                    className="min-w-full table-auto"
                  >
                    <TableHeader>
                      <Column
                        isRowHeader
                        className={rowHeaderStyle}
                      >
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
                            <Cell
                              className={rowCellStyle}
                            >
                              <span className='p-2'>{idx + 1}</span>
                            </Cell>
                            {uploadDataHeaders.map(rowKey => (
                              <Cell
                                className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none"
                                key={rowKey}
                              >
                                <span className='p-2'>
                                  {typeof rowData[rowKey] === 'string' ? rowData[rowKey] : JSON.stringify(rowData[rowKey])}
                                </span>
                              </Cell>
                            ))}
                          </Row>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              }
              <div className="flex justify-end mt-2">
                {userUploadData.length > 0 &&
                  <Button
                    className="hover:no-underline flex items-center gap-2 hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--hl] transition-colors rounded-sm"
                    onPress={handleClearData}
                  >
                    Remove Data
                  </Button>
                }
                <Button
                  isDisabled={uploadData.length < 1}
                  className="hover:no-underline ml-4 flex items-center gap-2 bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
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
