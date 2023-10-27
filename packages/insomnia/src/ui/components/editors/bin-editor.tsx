import React, { FormEvent } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useParams } from 'react-router-dom';

import { database } from '../../../common/database';
import * as models from '../../../models';
import { RequestBin } from '../../../models/request-bin';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { CodeEditor } from '../codemirror/code-editor';
import { showPrompt } from '../modals';

export const BinEditor = () => {
  const { workspaceId, requestId } = useParams() as { workspaceId: string; requestId: string };

  // const mockResponse = async () => {
  //   if (!activeResponse) {
  //     return;
  //   }
  //   const { statusCode, statusMessage, headers, httpVersion, bytesContent, contentType } = activeResponse;
  //   const body = await readFile(activeResponse.bodyPath, 'utf8');
  //   // transform response to mockbin format
  //   const bin = await window.main.axiosRequest({
  //     url: 'http://mockbin.org/bin/create',
  //     method: 'post',
  //     data: {
  //       'status': statusCode,
  //       'statusText': statusMessage,
  //       'httpVersion': httpVersion,
  //       'headers': headers,
  //       // NOTE: cookies are sent as headers by insomnia
  //       'cookies': [],
  //       'content': {
  //         'size': bytesContent,
  //         'mimeType': contentType,
  //         'text': body,
  //       },
  //     },
  //   });
  //   // todo: record bin id in insomnia db
  //   // todo: list all bins
  //   // todo: show bin logs
  //   // todo: handle error
  //   if (bin?.data) {
  //     const id = bin.data;
  //     createRequest({
  //       requestType: 'RequestBin',
  //       parentId: workspaceId,
  //       req: {
  //         ...activeRequest,
  //         name: 'Mock Response of ' + activeRequest.name,
  //         method: activeRequest.method,
  //         url: `https://mockbin.org/bin/${id}`,
  //       },
  //     });
  //     await database.docCreate<RequestBin>(models.requestBin.type, {
  //       parentId: workspaceId,
  //       name: 'New Request Bin',
  //       url: req?.url || '',
  //     });
  //   }
  // };
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
              Example responses
              <i className="fa fa-caret-down pad-left-sm" />
            </DropdownButton>
          }
        >
          <DropdownSection
            aria-label="Saved"
            title="Saved"
          >
            <DropdownItem aria-label='New Bin #1'>
              <ItemContent
                label="New Bin #1"
                onClick={() => {

                }}
              />
            </DropdownItem>
            <DropdownItem aria-label='New Bin #2'>
              <ItemContent
                label="New Bin #2"
                onClick={() => { }}
              />
            </DropdownItem>
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
                onClick={() => { }}
              />
            </DropdownItem>
            <DropdownItem aria-label='Plaintext'>
              <ItemContent
                label="Plaintext"
                onClick={() => { }}
              />
            </DropdownItem>
          </DropdownSection>
        </Dropdown>
        <div className='form-control form-control--outlined'>
          <label>
            Status
            <input name="status" type="text" defaultValue="200" />
          </label>
        </div>
        <div className='form-control form-control--outlined'>
          <label>
            Headers
            <CodeEditor
              id="example-headers-editor"
              onChange={() => { }}
              className='min-h-[50px]'
              defaultValue={`Content-Type: application/json
User-Agent: insomnia/8.2.0`}
            />
          </label>
        </div>
        <div className='form-control form-control--outlined'>
          <label>
            Body
            <CodeEditor
              id="example-body-editor"
              className='min-h-[100px]'
              onChange={() => { }}
              defaultValue={`{
  "a": "b"
}`}
            />
          </label>
        </div>
        <button type="submit" name="save">Save</button>
        <button type="submit" name="send">send</button>
      </form>
    </div>
  );
};
