import { readFile } from 'fs/promises';
import React, { FormEvent, useRef, useState } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import { database } from '../../../common/database';
import * as models from '../../../models';
import { RequestBin } from '../../../models/request-bin';
import { Response } from '../../../models/response';
import { RequestLoaderData } from '../../routes/request';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { CodeEditor, CodeEditorHandle } from '../codemirror/code-editor';
import { showPrompt } from '../modals';

export const BinEditor = () => {
  const { workspaceId, requestId } = useParams() as { workspaceId: string; requestId: string };
  const { activeRequest, requestBins } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const [binStatus, setBinStatus] = useState('202');
  const [binHeaders, setBinHeaders] = useState('');
  const [binBody, setBinBody] = useState('');
  const headerEditorRef = useRef<CodeEditorHandle>(null);
  const bodyEditorRef = useRef<CodeEditorHandle>(null);
  const responseToMockBin = async (activeResponse: Response) => {
    const { statusCode, statusMessage, headers, httpVersion, bytesContent, contentType } = activeResponse;
    const body = await readFile(activeResponse.bodyPath, 'utf8');
    return {
      'status': statusCode,
      'statusText': statusMessage,
      'httpVersion': httpVersion,
      'headers': headers,
      // NOTE: cookies are sent as headers by insomnia
      'cookies': [],
      'content': {
        'size': bytesContent,
        'mimeType': contentType,
        'text': body,
      },
    };
  };
  const createBinOnRemoteFromResponse = async (activeResponse: Response): Promise<string> => {
    const mockbinData = await responseToMockBin(activeResponse);
    const bin = await window.main.axiosRequest({
      url: 'http://mockbin.org/bin/create',
      method: 'post',
      data: mockbinData,
    });
    // todo: show bin logs
    // todo: handle error
    // todo create/update current bin url

    if (bin?.data) {
      return bin.data;
    }
    return '';

  };

  return (
    <div className='p-5'>
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const status = formData.get('status') as string;
          const headers = formData.get('example-headers-editor') as string;
          const body = formData.get('example-body-editor') as string;
          console.log(status, headers, body);
          if (e.nativeEvent.submitter.name === 'send') {
            console.log('TODO: create bin with current form and send request to it');
          }
          if (e.nativeEvent.submitter.name === 'save') {
            console.log('save bin to local db and show in dropdown');
            showPrompt({
              title: 'Create a new bin',
              defaultValue: 'New Bin',
              submitName: 'Create',
              onComplete: async (name: string) => {
                console.log(name);
                const requestBin = {
                  parentId: workspaceId,
                  name: name || 'New Bin',
                  statusCode: +status,
                  headers: headers || '',
                  body: body || '',
                };
                database.docCreate<RequestBin>(models.requestBin.type, requestBin);
              },
            });
          }
          if (e.nativeEvent.submitter.name === 'copy') {
            console.log('TODO: create bin with current form and copy url to clipboard');
          }
        }
        }
      >
        <TooltipTrigger>
          <Button
            aria-label='Send'
            className="pull-right btn btn--clicky ml-2"
            name="send"
            type="submit"
            onPress={() => {
              // stuff
            }}
          >Send</Button>
          <Tooltip
            placement="top"
            offset={8}
            className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
          >
            Create a new bin and send a request to it
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Button
            aria-label='Save'
            name="save"
            type="submit"
            className="pull-right btn btn--clicky ml-2"
            onPress={async () => {

            }}
          >Save</Button>
          <Tooltip
            placement="top"
            offset={8}
            className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
          >
            Save this bin with a name and description
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Button
            aria-label='Copy Bin URL'
            name="copy"
            type="submit"
            className="pull-right btn btn--clicky ml-2"
          >Copy Bin URL</Button>
          <Tooltip
            placement="top"
            offset={8}
            className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
          >
            Copy bin URL to clipboard
          </Tooltip>
        </TooltipTrigger>
        <Dropdown
          aria-label='Examples'
          triggerButton={
            <DropdownButton
              variant='outlined'
              removePaddings={false}
              disableHoverBehavior={false}
            >
              Load from template
              <i className="fa fa-caret-down pad-left-sm" />
            </DropdownButton>
          }
        >
          <DropdownSection
            aria-label="Saved"
            title="Saved"
          >{requestBins.map(bin => (
            <DropdownItem key={bin._id} aria-label={bin.name}>
              <ItemContent
                label={bin.name}
                onClick={() => {
                  setBinStatus(bin.statusCode + '');
                  headerEditorRef.current?.setValue(bin.headers);
                  bodyEditorRef.current?.setValue(bin.body);
                }}
              />
            </DropdownItem>
          ))}
          </DropdownSection>
          <DropdownSection
            aria-label="From Spec"
            title="From Spec"
          >
            <DropdownItem aria-label='/user/create'>
              <ItemContent
                label="/user/create"
                onClick={() => { }}
              />
            </DropdownItem>
            <DropdownItem aria-label='/user/update'>
              <ItemContent
                label="/user/update"
                onClick={() => { }}
              />
            </DropdownItem>
            <DropdownItem aria-label='/user/delete'>
              <ItemContent
                label="/user/delete"
                onClick={() => { }}
              />
            </DropdownItem>
          </DropdownSection>
          <DropdownSection
            aria-label="Basic Section"
            title="Basic"
          >
            <DropdownItem aria-label='JSON'>
              <ItemContent
                label="JSON"
                onClick={() => {
                  setBinStatus('200');
                  headerEditorRef.current?.setValue('Content-Type: application/json');
                  bodyEditorRef.current?.setValue('{\n    \"foo\": \"Hello Word\"\n}');
                }}
              />
            </DropdownItem>
            <DropdownItem aria-label='Plaintext'>
              <ItemContent
                label="Plaintext"
                onClick={() => {
                  setBinStatus('200');
                  headerEditorRef.current?.setValue('Content-Type: text/plain');
                  bodyEditorRef.current?.setValue('Hello World');
                }}
              />
            </DropdownItem>
          </DropdownSection>
        </Dropdown>
        <div className='form-control form-control--outlined'>
          <label>
            Status
            <input name="status" type="number" value={binStatus} onChange={e => setBinStatus(e.target.value)} />
          </label>
        </div>
        <div className='form-control form-control--outlined'>
          <label>
            Headers
            <CodeEditor
              ref={headerEditorRef}
              id="example-headers-editor"
              className='min-h-[50px]'
              defaultValue={binHeaders}
              onChange={setBinHeaders}
            />
          </label>
        </div>
        <div className='form-control form-control--outlined'>
          <label>
            Body
            <CodeEditor
              ref={bodyEditorRef}
              id="example-body-editor"
              className='min-h-[100px]'
              defaultValue={binBody}
              onChange={setBinBody}
            />
          </label>
        </div>
      </form>
    </div>
  );
};
