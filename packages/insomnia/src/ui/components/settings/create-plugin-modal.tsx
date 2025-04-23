import React, { useState } from 'react';
import { Button, Dialog, Heading, Input, Label, Modal, ModalOverlay, TextField } from 'react-aria-components';

import { Icon } from '../icon';
import { createPlugin } from '../../../plugins/create';
import { docsPlugins } from '../../../common/documentation';

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

function validatePluginName(name: string) {
  // Validate name
  if (!name.match(/^[a-z0-9]+(-[a-z0-9]+)*$/)) {
    return 'Plugin name must be of format my-plugin-name';
  }

  if (name.match(/--/)) {
    return 'Plugin name must not contain consecutive dashes';
  }

  if (name.match(/^[a-z]-/)) {
    return 'Plugin name must not start with a dash';
  }

  if (name.match(/-$/)) {
    return 'Plugin name must not end with a dash';
  }

  if (name.match(/^-$/)) {
    return 'Plugin name must not be a single dash';
  }

  return null;
}

export const CreatePluginModal = ({ onClose, onComplete }: Props) => {
  const [name, setName] = useState('demo-example');
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col w-full max-w-3xl h-max max-h-[calc(100%-var(--padding-xl))] rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden h-full'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl flex items-center gap-2'>New Plugin</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='rounded flex-1 w-full overflow-hidden basis-28§ flex flex-col gap-2 select-none overflow-y-auto'>
                <TextField
                  name="name"
                  isRequired
                  defaultValue='demo-example'
                  className="group relative flex-shrink-0 flex flex-col gap-2 overflow-hidden max-w-full"
                  onBlur={() => {
                    // Remove insomnia-plugin- prefix if they accidentally typed it
                    const nameWithoutPrefix = name.replace(/^insomnia-plugin-/, '');

                    const errorMessage = validatePluginName(nameWithoutPrefix);
                    if (errorMessage) {
                      setError(errorMessage);
                      return;
                    }

                    setError(null);
                  }}
                  onChange={(value) => {
                    setName(value);
                    setError(null);
                  }}
                >
                  <Label className={`text-sm text-[--hl] p-0 ${error && name ? 'text-[rgba(var(--color-danger-rgb),0.5)]' : ''}`} slot='label'>
                    Plugin Name
                  </Label>
                  <div className={`flex items-center rounded-sm border border-solid border-[--hl-sm] ${error && name ? 'border-[rgba(var(--color-danger-rgb),0.5)]' : ''}`}>
                    <div className={`flex-shrink-0 p-3 flex items-center justify-center bg-[--hl-sm] ${error && name ? 'bg-[rgba(var(--color-danger-rgb),0.5)]' : ''}`}>
                      <p className="italic text-sm text-[--color-font] h-full flex items-center">
                        insomnia-plugin-
                      </p>
                    </div>
                    <Input
                      placeholder='example-name'
                      autoFocus
                      className='p-2 w-full bg-[--color-bg] text-[--color-font]'
                    />
                  </div>
                  <Label slot='description' className='text-sm text-[--hl] p-0'>
                    {error ?? 'Plugin name must be of format my-plugin-name'}
                  </Label>
                </TextField>
              </div>
              <div className='flex items-center justify-end'>
                <Button
                  className="m-1 px-[--padding-md] h-[--line-height-xs] py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all border border-solid border-[--hl-lg] rounded-[--radius-md]"
                  type='button'
                  isDisabled={!name}
                  onPress={async () => {
                    // Remove insomnia-plugin- prefix if they accidentally typed it
                    const nameWithoutPrefix = name.replace(/^insomnia-plugin-/, '');

                    const errorMessage = validatePluginName(nameWithoutPrefix);

                    if (errorMessage) {
                      setError(errorMessage);
                      return;
                    }

                    try {
                      await createPlugin(
                        `insomnia-plugin-${nameWithoutPrefix}`,
                        '0.0.1',
                        [
                          '// For help writing plugins, visit the documentation to get started:',
                          `// ${docsPlugins}`,
                          '',
                          '// TODO: Add plugin code here...',
                        ].join('\n'),
                      );

                      onComplete();
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                >
                  Generate
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

CreatePluginModal.displayName = 'CreatePluginModal';
