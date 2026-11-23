import { useState } from 'react';
import { Dialog, DialogTrigger, Form, FormContext, Heading, Popover } from 'react-aria-components';

import { Button, Icon } from '~/basic-components';
import { Input } from '~/ui/components/base/input';

import { validateRepoFolderName } from '../../../sync/git/repo-folder-path';

/**
 * "New folder" button that opens a small form in a popover to name a folder created inside `parentLabel`.
 * The form lives in its own popover so it never interferes with the surrounding form or the folder tree.
 */
export const NewRepoFolderPopover = ({
  parentLabel,
  siblingNames,
  isDisabled,
  onCreate,
}: {
  parentLabel: string;
  siblingNames: string[];
  isDisabled?: boolean;
  onCreate: (name: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setName('');
      setError(null);
    }
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button variant="text" size="sm" isDisabled={isDisabled} icon={<Icon icon="folder-plus" />}>
        New folder
      </Button>
      <Popover
        placement="bottom end"
        offset={4}
        className="w-80 rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-4 text-sm text-(--color-font) shadow-lg"
      >
        <Dialog aria-label="New folder" className="outline-hidden">
          {/*
            React Aria's Form inherits every prop of an enclosing Form through FormContext (including onSubmit,
            which gets chained), so without resetting it submitting this form would also submit the workspace form.
          */}
          <FormContext.Provider value={null}>
            <Form
              validationBehavior="aria"
              className="flex flex-col gap-3"
              onSubmit={e => {
                e.preventDefault();
                // The popover is portaled, but React still bubbles the submit event to the workspace form.
                e.stopPropagation();

                const validationError = validateRepoFolderName(name, siblingNames);
                if (validationError) {
                  setError(validationError);
                  return;
                }

                onCreate(name);
                setIsOpen(false);
              }}
            >
              <Heading slot="title" className="flex flex-col gap-1">
                <span className="font-semibold">New folder in</span>
                <span className="truncate text-xs font-normal text-(--hl)" title={parentLabel}>
                  {parentLabel}
                </span>
              </Heading>
              <Input
                aria-label="Folder name"
                autoFocus
                value={name}
                isInvalid={Boolean(error)}
                errorMessage={error ?? undefined}
                onChange={value => {
                  setName(value);
                  setError(null);
                }}
                className="gap-1"
              />
              <div className="flex justify-end gap-2">
                <Button variant="text" size="sm" onPress={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button primary size="sm" type="submit">
                  Create
                </Button>
              </div>
            </Form>
          </FormContext.Provider>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
