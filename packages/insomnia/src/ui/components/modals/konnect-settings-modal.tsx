import { useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { validatePat } from '~/konnect/api';
import { useRootLoaderData } from '~/root';
import { AnalyticsEvent } from '~/ui/analytics';

import { useSettingsPatcher } from '../../hooks/use-request';
import { Icon } from '../icon';

export const KonnectSettingsModal = ({ onClose }: { onClose: () => void }) => {
  const { settings } = useRootLoaderData()!;
  const patchSettings = useSettingsPatcher();

  const [pat, setPat] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleConnect = async () => {
    const trimmed = pat.trim();
    if (!trimmed) {
      return;
    }
    setStatus('validating');
    setValidationError(null);
    const result = await validatePat(trimmed);
    setStatus(result.valid ? 'valid' : 'invalid');
    if (result.valid) {
      await window.main.secretStorage.setSecret('konnectPat', trimmed);
      patchSettings({ hasKonnectPat: true });
      setPat('');
      window.main.trackAnalyticsEvent({ event: AnalyticsEvent.kongKonnectPatValidated });
    } else {
      setValidationError(result.error ?? 'Invalid PAT. Check your input and try again.');
    }
  };

  const handleDisconnect = async () => {
    await window.main.secretStorage.deleteSecret('konnectPat');
    patchSettings({ hasKonnectPat: false });
    setPat('');
    setStatus('idle');
    setValidationError(null);
  };

  const isConnected = settings.hasKonnectPat && status !== 'invalid';

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        if (!isOpen) {
          onClose();
        }
      }}
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal className="flex w-full max-w-lg flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex h-full flex-1 flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-lg font-bold">
                  Kong Konnect settings
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-sm text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold" htmlFor="konnect-modal-pat">
                  Personal Access Token
                </label>
                <p className="text-sm text-(--hl)">
                  Enter a Personal Access Token (PAT) to sync your Konnect control planes into Insomnia projects.
                </p>
                <button
                  className="w-fit text-sm text-(--color-font) underline hover:opacity-80"
                  onClick={() => window.main.openInBrowser('https://cloud.konghq.com/global/account/tokens')}
                >
                  Generate new PAT <Icon icon="arrow-up-right-from-square" className="text-xs" />
                </button>

                <input
                  id="konnect-modal-pat"
                  type="password"
                  className="rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1.5 text-(--color-font) focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                  placeholder={
                    isConnected
                      ? 'Enter new PAT to replace existing'
                      : 'e.g. kpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                  }
                  value={pat}
                  onChange={e => {
                    setPat(e.target.value);
                    if (status !== 'idle') {
                      setStatus('idle');
                      setValidationError(null);
                    }
                  }}
                  autoComplete="off"
                />

                {status === 'invalid' && (
                  <p className="text-sm text-(--color-danger)">
                    {validationError ?? 'Invalid PAT. Check your input and try again.'}
                  </p>
                )}
                {(status === 'valid' || (isConnected && status === 'idle')) && (
                  <p className="text-sm text-(--color-success)">Connected</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  className="disabled:forbid-pointer-events rounded-xs border border-solid border-(--hl-sm) px-3 py-1.5 text-sm text-(--color-font) hover:bg-(--hl-xs) disabled:cursor-not-allowed disabled:opacity-50"
                  isDisabled={!pat.trim() || status === 'validating'}
                  onPress={handleConnect}
                >
                  {status === 'validating' ? <Icon icon="spinner" className="animate-spin" /> : 'Connect & Sync'}
                </Button>
                {isConnected && (
                  <Button
                    className="rounded-xs border border-solid border-(--hl-sm) px-3 py-1.5 text-sm font-semibold text-(--color-font) hover:bg-(--hl-xs)"
                    onPress={handleDisconnect}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
