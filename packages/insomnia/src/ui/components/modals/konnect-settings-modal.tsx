import { services } from 'insomnia-data';
import { useEffect, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { database } from '~/common/database';
import { validatePat } from '~/konnect/api';
import { useRootLoaderData } from '~/root';
import { AnalyticsEvent } from '~/ui/analytics';

import { useSettingsPatcher } from '../../hooks/use-request';
import { Icon } from '../icon';

export const KonnectSettingsModal = ({
  onClose,
  syncKonnectProjectsAndNotifyRef,
}: {
  onClose: () => void;
  syncKonnectProjectsAndNotifyRef: React.MutableRefObject<() => Promise<void>>;
}) => {
  const { settings } = useRootLoaderData()!;
  const patchSettings = useSettingsPatcher();

  const [pat, setPat] = useState('');
  const [isPatVisible, setIsPatVisible] = useState(false);
  // 'idle' | 'validating' | 'valid' | 'invalid'
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  // Controls whether the disconnect confirmation screen is shown
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Validate the given PAT against the Konnect API and update status/error state accordingly.
  const validateAndSetStatus = async (trimmed: string) => {
    setStatus('validating');
    setValidationError(null);
    const result = await validatePat(trimmed);
    setStatus(result.valid ? 'valid' : 'invalid');
    if (!result.valid) {
      setValidationError(result.error ?? 'Invalid PAT. Check your input and try again.');
    }
    return result;
  };

  // On mount: if a PAT is already stored, load it from secure storage and validate it.
  useEffect(() => {
    if (settings.hasKonnectPat) {
      window.main.secretStorage.getSecret('konnectPat').then(secret => {
        if (secret) {
          setPat(secret);
          validateAndSetStatus(secret);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validate the PAT, persist it to secure storage, and trigger an initial sync.
  const handleConnect = async () => {
    const trimmed = pat.trim();
    if (!trimmed) {
      return;
    }
    const result = await validateAndSetStatus(trimmed);
    if (result.valid) {
      await window.main.secretStorage.setSecret('konnectPat', trimmed);
      patchSettings({ hasKonnectPat: true });
      window.main.trackAnalyticsEvent({ event: AnalyticsEvent.kongKonnectPatValidated });
      syncKonnectProjectsAndNotifyRef.current();
    }
  };

  // Delete all Konnect-synced projects from the local DB, remove the stored PAT, and close the modal.
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const allProjects = await services.project.list();
      const konnectProjects = allProjects.filter(p => p.konnectControlPlaneId != null);
      const bufferId = await database.bufferChangesIndefinitely();
      try {
        for (const project of konnectProjects) {
          await services.project.remove(project);
        }
      } finally {
        await database.flushChanges(bufferId);
      }
      await window.main.secretStorage.deleteSecret('konnectPat');
      patchSettings({ hasKonnectPat: false });
      onClose();
    } finally {
      setIsDisconnecting(false);
    }
  };

  // A connected state means the PAT is saved and has not been found invalid.
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
      <Modal className="flex w-full max-w-3xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex h-full flex-1 flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  {showDisconnectConfirm ? 'Disconnect Kong Konnect?' : 'Kong Konnect settings'}
                </Heading>
                <Button
                  aria-label="Close"
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-sm text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>

              {showDisconnectConfirm ? (
                <>
                  <p className="text-sm">
                    Disconnecting will remove your Personal Access Token and delete related project data. This action
                    cannot be undone. Are you sure?
                  </p>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      className="rounded-xs border border-solid border-(--hl-sm) px-4 py-2 text-sm text-(--color-font) hover:bg-(--hl-xs)"
                      onPress={() => setShowDisconnectConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="rounded-xs bg-(--color-danger) px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      isDisabled={isDisconnecting}
                      onPress={handleDisconnect}
                    >
                      {isDisconnecting ? <Icon icon="spinner" className="animate-spin" /> : 'Disconnect & delete data'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-semibold" htmlFor="konnect-modal-pat">
                        Personal Access Token
                      </label>
                      <p className="text-sm text-(--hl)">
                        Enter a Personal Access Token (PAT) to sync your Konnect control planes into Insomnia projects.
                      </p>
                      <button
                        className="w-fit text-sm text-(--hl) underline hover:opacity-80"
                        onClick={() => window.main.openInBrowser('https://cloud.konghq.com/global/account/tokens')}
                      >
                        Generate new PAT ↗
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="konnect-modal-pat"
                        type={isPatVisible ? 'text' : 'password'}
                        className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1.5 pr-8 text-(--color-font) focus:border-(--hl-lg) focus:outline-hidden"
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
                      <Button
                        aria-label={isPatVisible ? 'Hide PAT' : 'Show PAT'}
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-sm text-(--hl) hover:text-(--color-font)"
                        onPress={() => setIsPatVisible(v => !v)}
                      >
                        <Icon icon={isPatVisible ? 'eye-slash' : 'eye'} />
                      </Button>
                    </div>

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
                      className="rounded-xs border border-solid border-(--hl-sm) px-3 py-1.5 text-sm text-(--color-font) hover:bg-(--hl-xs) disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                      isDisabled={!pat.trim() || status === 'validating'}
                      onPress={handleConnect}
                    >
                      {status === 'validating' ? <Icon icon="spinner" className="animate-spin" /> : 'Connect & Sync'}
                    </Button>
                    {isConnected && (
                      <Button
                        className="rounded-xs px-3 py-1.5 text-sm text-(--color-font) hover:bg-(--hl-xs)"
                        onPress={() => setShowDisconnectConfirm(true)}
                        isDisabled={status === 'validating'}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
