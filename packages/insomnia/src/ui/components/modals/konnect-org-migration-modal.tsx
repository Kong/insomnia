import { useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay, Radio, RadioGroup } from 'react-aria-components';

import type { KonnectMigrationGroup } from '~/konnect/migrate-konnect-organization';
import { runKonnectOrgMigration } from '~/konnect/migrate-konnect-organization';
import { KongLogo } from '~/ui/components/kong-logo';

import { Icon } from '../icon';

export const KonnectOrgMigrationModal = ({
  accountId,
  groups,
  onDone,
}: {
  accountId: string;
  groups: KonnectMigrationGroup[];
  onDone: () => void;
}) => {
  const [keepOrganizationId, setKeepOrganizationId] = useState(groups[0]?.organizationId ?? '');
  const [isMigrating, setIsMigrating] = useState(false);

  const handleConfirm = async () => {
    setIsMigrating(true);
    try {
      await runKonnectOrgMigration({ accountId, keepOrganizationId });
      onDone();
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <ModalOverlay
      isOpen
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal className="flex w-full max-w-2xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          <div className="flex h-full flex-1 flex-col gap-4">
            <div className="flex items-center gap-2">
              <KongLogo width={20} height={20} />
              <Heading slot="title" className="text-2xl">
                Choose which Konnect data to keep
              </Heading>
            </div>

            <p className="text-sm text-(--hl)">
              Konnect data is now stored once per account in the <strong>Control Planes</strong> organization, but this
              computer has Konnect data under more than one organization. Pick the one to keep — the others will be
              deleted along with their collections and requests.
            </p>

            <RadioGroup
              aria-label="Organization to keep"
              value={keepOrganizationId}
              onChange={setKeepOrganizationId}
              className="flex flex-col gap-2"
            >
              {groups.map(group => (
                <Radio
                  key={group.organizationId}
                  value={group.organizationId}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-sm border border-solid border-(--hl-sm) p-3 text-sm transition-colors hover:bg-(--hl-xs) data-selected:border-(--color-surprise) data-selected:bg-(--hl-xs)"
                >
                  <span className="min-w-0 truncate font-semibold">{group.organizationName}</span>
                  <span className="shrink-0 text-(--hl)">
                    {group.projectCount} control plane(s), {group.workspaceCount} collection(s)
                  </span>
                </Radio>
              ))}
            </RadioGroup>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                isDisabled={isMigrating || !keepOrganizationId}
                onPress={handleConfirm}
                className="flex items-center gap-2 rounded-sm bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMigrating && <Icon icon="spinner" className="animate-spin" />}
                Keep this organization
              </Button>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
