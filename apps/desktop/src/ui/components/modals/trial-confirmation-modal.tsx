import type { FC } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { Icon } from '~/ui/components/icon';

interface TrialConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTrial: () => void;
  isLoading?: boolean;
}

const TRIAL_BENEFITS = [
  {
    title: 'User governance',
    description: 'Control access at every level with SSO, SCIM, RBAC, and Teams.',
  },
  {
    title: 'Increased storage, security, and compliance',
    description: 'Keep your data safe, organized, and fully under your control with enterprise storage and governance.',
  },
  {
    title: 'No limits on productivity',
    description:
      'Enjoy unlimited Mock Server requests, unlimited collaboration on Git Sync projects, and access to native Vault integrations.',
  },
];

export const TrialConfirmationModal: FC<TrialConfirmationModalProps> = ({
  isOpen,
  onClose,
  onStartTrial,
  isLoading = false,
}) => {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={open => {
          if (!open) {
            onClose();
          }
        }}
        className="flex w-[540px] flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-[30px] text-(--color-font)"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="text-[18px] text-(--color-font)">
                  Try Insomnia Enterprise free for 14 days
                </Heading>
                <Button
                  className="ml-auto flex h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={() => close()}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex flex-col">
                <p className="text-sm text-[--hl-xl]">No credit card required to explore the benefits:</p>
                <ul className="mt-6 flex flex-col items-start gap-4">
                  {TRIAL_BENEFITS.map(benefit => (
                    <li key={benefit.title} className="flex flex-col">
                      <div className="flex items-center gap-[8px]">
                        <Icon icon="check-circle" className="h-[16px] text-(--color-surprise)" />
                        <span className="font-semibold">{benefit.title}</span>
                      </div>
                      <span className="mt-1 ml-[24px] text-sm text-[--hl-xl]">{benefit.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 flex justify-end gap-[8px]">
                <Button
                  className="h-[30px] rounded-sm border border-solid border-(--hl-md)! px-[12px] text-sm text-(--color-font) hover:bg-(--hl-xs)"
                  onPress={() => close()}
                >
                  Nevermind
                </Button>
                <Button
                  className="h-[30px] rounded-sm bg-(--color-surprise) px-[12px] text-center text-sm text-(--color-font-surprise)"
                  isDisabled={isLoading}
                  onPress={onStartTrial}
                >
                  {isLoading ? 'Starting...' : 'Start Free Trial'}
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

TrialConfirmationModal.displayName = 'TrialConfirmationModal';
