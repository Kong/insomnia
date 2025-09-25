import fs from 'node:fs/promises';

import React from 'react';
import {
  Button,
  Dialog,
  FieldError,
  Form,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from 'react-aria-components';
import { useParams } from 'react-router';

import { useMockRouteUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.update';
import { useMockRouteNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.new';

import { HTTP_METHODS } from '../../../common/constants';
import type { ResponseHeader } from '../../../models/response';
import { Icon } from '../icon';

export interface MockRouteModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  defaultPath?: string;
  defaultMethod?: string;
  mode: 'create' | 'edit';
  mockRouteId?: string;
  mockServerId?: string;
  mockServerName?: string;
  responseData?: {
    bodyPath?: string;
    headers: ResponseHeader[];
    statusCode: number;
    mimeType: string;
  };
}

export const MockRouteModal = ({
  isOpen,
  onOpenChange,
  title,
  defaultPath,
  defaultMethod,
  mode,
  mockRouteId,
  mockServerId,
  mockServerName,
  responseData,
}: MockRouteModalProps) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const createFetcher = useMockRouteNewActionFetcher();
  const updateFetcher = useMockRouteUpdateActionFetcher();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const isValid = event.currentTarget.checkValidity();
    if (!isValid) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const path = formData.get('path') as string;
    const method = formData.get('method') as string;

    let body = '';
    if (responseData?.bodyPath) {
      try {
        const bodyBuffer = await fs.readFile(responseData.bodyPath);
        body = bodyBuffer.toString();
      } catch (error) {
        console.error('Failed to read response body:', error);
      }
    }

    if (mode === 'create') {
      const patchData = {
        name: path,
        method: method,
        ...(responseData && {
          body,
          headers: responseData.headers,
          statusCode: responseData.statusCode,
          mimeType: responseData.mimeType,
        }),
        ...(mockServerId ? { parentId: mockServerId } : {}),
        ...(mockServerName ? { mockServerName } : {}),
      };

      createFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        patch: patchData,
      });
    } else {
      const patchData = {
        name: path,
        method,
        ...(responseData && {
          body,
          headers: responseData.headers,
          statusCode: responseData.statusCode,
          mimeType: responseData.mimeType,
        }),
      };

      updateFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        mockRouteId: mockRouteId!,
        patch: patchData,
      });
    }
  };

  const currentFetcher = mode === 'create' ? createFetcher : updateFetcher;

  React.useEffect(() => {
    if (mode === 'edit' && currentFetcher.state === 'idle' && currentFetcher.data === null) {
      onOpenChange(false);
    }
  }, [currentFetcher.state, currentFetcher.data, mode, onOpenChange]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
    >
      <Modal className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font]">
        <Dialog className="flex flex-col overflow-hidden outline-none">
          <div className="flex items-center justify-between gap-2 p-[--padding-md]">
            <Heading className="text-lg font-bold">{title}</Heading>
            <Button
              className="flex aspect-square h-8 items-center justify-center rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none"
              onPress={() => onOpenChange(false)}
            >
              <Icon icon="x" />
            </Button>
          </div>
          {currentFetcher.data?.error && (
            <div className="px-[--padding-md] pb-[--padding-md]">
              <div className="flex items-center gap-2 rounded-sm bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-[--color-font-danger]">
                <span>Error: {currentFetcher.data.error}</span>
              </div>
            </div>
          )}
          <Form onSubmit={handleSubmit} className="flex flex-col gap-4 p-[--padding-md]">
            <TextField
              name="path"
              defaultValue={defaultPath || '/'}
              isRequired
              validate={path => {
                if (!path.startsWith('/')) {
                  return 'Path must begin with a /';
                }
                return null;
              }}
              className="group relative flex flex-col gap-2"
            >
              <Label className="text-sm text-[--hl]">Path</Label>
              <Input
                autoFocus
                type="text"
                placeholder="/path/to/resource"
                className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
              />
              <FieldError className="text-xs text-red-500" />
            </TextField>
            <div className="group relative flex flex-col gap-2">
              <label className="text-sm text-[--hl]">HTTP Method</label>
              <select
                name="method"
                defaultValue={defaultMethod || 'GET'}
                required
                className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
              >
                {HTTP_METHODS.map(method => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                onPress={() => onOpenChange(false)}
                isDisabled={currentFetcher.state !== 'idle'}
                className="rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--color-font] transition-colors hover:bg-opacity-90"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isDisabled={currentFetcher.state !== 'idle'}
                className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-center text-[--color-font-surprise] transition-colors hover:bg-opacity-90"
              >
                {title}
              </Button>
            </div>
          </Form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

MockRouteModal.displayName = 'MockRouteModal';
