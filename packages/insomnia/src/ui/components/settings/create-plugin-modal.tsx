import React, { useState } from 'react';
import { Button, Dialog, Heading, Input, Label, Modal, ModalOverlay, TextField } from 'react-aria-components';

import { docsPlugins } from '../../../common/documentation';
import { createPlugin } from '../../../plugins/create';
import { Icon } from '../icon';

interface Props {
  onClose: () => void;
  onComplete: () => void;
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
      className="fixed left-0 top-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex h-max max-h-[calc(100%-var(--padding-xl))] w-full max-w-3xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  New Plugin
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="basis-28§ flex w-full flex-1 select-none flex-col gap-2 overflow-hidden overflow-y-auto rounded-sm">
                <TextField
                  isRequired
                  defaultValue="demo-example"
                  className="group relative flex max-w-full shrink-0 flex-col gap-2 overflow-hidden"
                  onChange={value => {
                    setName(value);
                    setError(null);
                  }}
                >
                  <Label
                    className={`p-0 text-sm text-(--hl) ${error ? 'text-[rgba(var(--color-danger-rgb),0.5)]' : ''}`}
                    slot="label"
                  >
                    Plugin Name
                  </Label>
                  <div
                    className={`flex items-center rounded-xs border border-solid border-(--hl-sm) ${error ? 'border-[rgba(var(--color-danger-rgb),0.5)]' : ''}`}
                  >
                    <div
                      className={`flex shrink-0 items-center justify-center bg-(--hl-sm) p-3 ${error ? 'bg-[rgba(var(--color-danger-rgb),0.5)]' : ''}`}
                    >
                      <p className="flex h-full items-center text-sm italic text-(--color-font)">insomnia-plugin-</p>
                    </div>
                    <Input
                      aria-label="Plugin name"
                      data-testid="plugin-name-input"
                      placeholder="example-name"
                      autoFocus
                      className="w-full bg-(--color-bg) p-2 text-(--color-font)"
                    />
                  </div>
                  <Label slot="description" className="p-0 text-sm text-(--hl)" data-testid="plugin-name-error">
                    {error ?? 'Plugin name must be of format my-plugin-name'}
                  </Label>
                </TextField>
              </div>
              <div className="flex items-center justify-end">
                <Button
                  className="m-1 flex h-(--line-height-xs) items-center justify-center gap-2 rounded-md border border-solid border-(--hl-lg) px-(--padding-md) py-1 text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
                  type="button"
                  data-testid="generate-plugin-button"
                  onPress={async () => {
                    // Remove insomnia-plugin- prefix if they accidentally typed it
                    const nameWithoutPrefix = name.replace(/^insomnia-plugin-/, '');

                    try {
                      await createPlugin(
                        `insomnia-plugin-${nameWithoutPrefix}`,
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
