import { services } from 'insomnia-data';
import { useEffect, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { database } from '~/common/database';
import { fetchKonnectOrganizationId, validatePat } from '~/konnect/api';
import { useRootLoaderData } from '~/root';
import { AnalyticsEvent } from '~/ui/analytics';

import { useSettingsPatcher } from '../../hooks/use-request';
import { Icon } from '../icon';

export const KonnectSettingsModal = ({
  onClose,
  syncKonnectProjectsAndNotifyRef,
  onDisconnect,
}: {
  onClose: () => void;
  syncKonnectProjectsAndNotifyRef: React.MutableRefObject<(konnectOrganizationId?: string | null) => Promise<void>>;
  onDisconnect?: () => void;
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

  const validateAndSetStatus = async (trimmed: string): Promise<{ valid: boolean; orgId?: string }> => {
    const result = await validatePat(trimmed);
    const orgId = result.valid ? await fetchKonnectOrganizationId(trimmed) : undefined;
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.kongKonnectPatValidated,
      properties: {
        validation_status: result.valid ? 'valid' : 'invalid',
        ...(orgId ? { konnect_organization_id: orgId } : {}),
      },
    });
    setStatus(result.valid ? 'valid' : 'invalid');
    if (!result.valid) {
      setValidationError(result.error ?? 'Invalid PAT. Check your input and try again.');
    }
    return { valid: result.valid, orgId };
  };

  // On mount: if a PAT is already stored, load it into the input field.
  useEffect(() => {
    if (settings.hasKonnectPat) {
      window.main.secretStorage.getSecret('konnectPat').then(secret => {
        if (secret) {
          setPat(secret);
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
    setStatus('validating');
    setValidationError(null);
    const { valid, orgId } = await validateAndSetStatus(trimmed);
    if (!valid) {
      return;
    }
    await window.main.secretStorage.setSecret('konnectPat', trimmed);
    patchSettings({ hasKonnectPat: true, konnectOrganizationId: orgId ?? null });
    syncKonnectProjectsAndNotifyRef.current(orgId ?? null);
    onClose();
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
      patchSettings({ hasKonnectPat: false, konnectOrganizationId: null });
      onDisconnect?.();
      onClose();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const hasStoredPat = settings.hasKonnectPat && status !== 'invalid';

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
                          hasStoredPat
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
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      className="rounded-xs border border-solid border-(--hl-sm) px-3 py-1.5 text-sm text-(--color-font) hover:bg-(--hl-xs) disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                      isDisabled={!pat.trim() || status === 'validating'}
                      onPress={handleConnect}
                    >
                      {status === 'validating' ? <Icon icon="spinner" className="animate-spin" /> : 'Connect & Sync'}
                    </Button>
                    {hasStoredPat && (
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
