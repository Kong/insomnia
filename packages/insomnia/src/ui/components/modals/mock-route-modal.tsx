import type { ResponseHeader } from 'insomnia-data';
import React, { useState } from 'react';
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
import { UnsavedChangesGuard } from '~/ui/components/unsaved-changes-guard';

import { HTTP_METHODS } from '../../../common/constants';
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

  const effectiveDefaultPath = defaultPath || '/';
  const effectiveDefaultMethod = defaultMethod || 'GET';
  const [selectedPath, setSelectedPath] = useState(effectiveDefaultPath);
  const [selectedMethod, setSelectedMethod] = useState(effectiveDefaultMethod);

  const changedFieldCount = [selectedPath !== effectiveDefaultPath, selectedMethod !== effectiveDefaultMethod].filter(Boolean).length;

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
        body = await window.main.secureReadFile({ path: responseData.bodyPath });
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
    <UnsavedChangesGuard hasUnsavedChanges={changedFieldCount > 1} onClose={() => onOpenChange(false)}>
      {({ requestClose }) => (
        <ModalOverlay
          isOpen={isOpen}
          onOpenChange={open => {
            if (!open) requestClose();
          }}
          isDismissable={false}
          className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
        >
          <Modal className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font)">
            <Dialog className="flex flex-col overflow-hidden outline-hidden">
              <div className="flex items-center justify-between gap-2 p-(--padding-md)">
                <Heading className="text-lg font-bold">{title}</Heading>
                <Button
                  className="flex aspect-square h-8 items-center justify-center rounded-xs text-(--color-font) hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden"
                  onPress={requestClose}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              {currentFetcher.data?.error && (
                <div className="px-(--padding-md) pb-(--padding-md)">
                  <div className="flex items-center gap-2 rounded-xs bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-(--color-font-danger)">
                    <span>Error: {currentFetcher.data.error}</span>
                  </div>
                </div>
              )}
              <Form onSubmit={handleSubmit} className="flex flex-col gap-4 p-(--padding-md)">
                <TextField
                  name="path"
                  isRequired
                  validate={path => {
                    if (!path.startsWith('/')) {
                      return 'Path must begin with a /';
                    }
                    return null;
                  }}
                  className="group relative flex flex-col gap-2"
                  value={selectedPath}
                  onChange={v => setSelectedPath(v)}
                >
                  <Label className="text-sm text-(--hl)">Path</Label>
                  <Input
                    autoFocus
                    type="text"
                    placeholder="/path/to/resource"
                    className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                  />
                  <FieldError className="text-xs text-red-500" />
                </TextField>
                <div className="group relative flex flex-col gap-2">
                  <label className="text-sm text-(--hl)">HTTP Method</label>
                  <select
                    name="method"
                    onChange={e => setSelectedMethod(e.target.value)}
                    value={selectedMethod}
                    required
                    className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
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
                    onPress={requestClose}
                    isDisabled={currentFetcher.state !== 'idle'}
                    className="rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isDisabled={currentFetcher.state !== 'idle'}
                    className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-center text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90"
                  >
                    {title}
                  </Button>
                </div>
              </Form>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </UnsavedChangesGuard>
  );
};

MockRouteModal.displayName = 'MockRouteModal';
