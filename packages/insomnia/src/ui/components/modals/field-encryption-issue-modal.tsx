import React, { useEffect, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useRevalidator } from 'react-router';

import type { FieldEncryptionFailure, FieldEncryptionStatus } from '~/main/ipc/field-encryption';
import { showError } from '~/ui/components/modals';
import { fieldEncryption } from '~/ui/ipc';

import { Icon } from '../icon';

const secondaryButtonClassName =
  'flex h-10 items-center justify-center gap-2 rounded-md bg-(--color-bg) px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all hover:bg-(--hl-xs)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-pressed:opacity-80 disabled:opacity-50';
const primaryButtonClassName =
  'flex h-10 items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80 disabled:opacity-50';

interface AffectedDocument {
  key: string;
  label: string;
  type: string;
  paths: string[];
}

const groupByDocument = (failures: FieldEncryptionFailure[]) => {
  const documents = new Map<string, AffectedDocument>();
  for (const { type, _id, path, label } of failures) {
    const key = JSON.stringify([type, _id]);
    const document = documents.get(key) ?? { key, label, type, paths: [] };
    document.paths.push(path);
    documents.set(key, document);
  }
  return [...documents.values()];
};

const Frame = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <ModalOverlay
    isOpen
    isKeyboardDismissDisabled
    className="fixed top-[50%] left-0 z-10 flex h-(--visual-viewport-height) w-full translate-y-[-50%] items-center justify-center bg-black/30"
  >
    <Modal className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
      <Dialog
        data-testid="field-encryption-issue-modal"
        className="flex h-full flex-1 flex-col overflow-hidden outline-hidden"
      >
        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          <Heading slot="title" className="flex shrink-0 items-center gap-2 text-2xl">
            <Icon icon="triangle-exclamation" className="text-(--color-warning)" />
            {title}
          </Heading>
          {children}
        </div>
      </Dialog>
    </Modal>
  </ModalOverlay>
);

const ErrorMessage = ({ error }: { error: string | null }) =>
  error ? (
    <p role="alert" className="shrink-0 text-(--color-danger)">
      {error}
    </p>
  ) : null;

const DecryptionFailedDialog = ({ failures, onDone }: { failures: FieldEncryptionFailure[]; onDone: () => void }) => {
  const { revalidate } = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documents = groupByDocument(failures);

  const run = async (action: () => Promise<unknown>, { documentsChanged }: { documentsChanged: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (documentsChanged) {
        // The documents changed outside the router, so the loaders must read them again
        revalidate();
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Frame title="Some encrypted data could not be decrypted">
      <p className="shrink-0">
        Insomnia encrypts sensitive fields (passwords, tokens, cookie values and similar) in its local database, and the
        values below could not be decrypted. This may happen if the application data was moved from another machine or
        the OS credential store was reset.
      </p>
      <p className="shrink-0">
        <strong>Reset affected fields</strong> clears these values, and you will need to enter them again.{' '}
        <strong>Continue without decryption</strong> keeps them as they are: the fields will not work, but the data is
        preserved in case it can be recovered. You will be asked again the next time Insomnia starts.
      </p>
      <ul
        data-testid="field-encryption-failures"
        className="min-h-24 flex-1 divide-y divide-solid divide-(--hl-sm) overflow-y-auto rounded-md border border-solid border-(--hl-sm)"
      >
        {documents.map(document => (
          <li key={document.key} className="flex flex-col gap-1 px-3 py-2">
            <span className="truncate font-semibold" title={document.label}>
              {document.label} <span className="font-normal text-(--hl)">({document.type})</span>
            </span>
            <span className="flex flex-wrap gap-1">
              {document.paths.map(path => (
                <code key={path} className="rounded-xs bg-(--hl-xs) px-1 text-sm">
                  {path}
                </code>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <ErrorMessage error={error} />
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button
          data-testid="field-encryption-continue"
          className={secondaryButtonClassName}
          isDisabled={busy}
          onPress={() => run(() => fieldEncryption.dismiss(), { documentsChanged: false })}
        >
          Continue without decryption
        </Button>
        <Button
          data-testid="field-encryption-reset-fields"
          className={primaryButtonClassName}
          isDisabled={busy}
          onPress={() => run(() => fieldEncryption.resetFailedFields(), { documentsChanged: true })}
        >
          Reset affected fields
        </Button>
      </div>
    </Frame>
  );
};

const DegradedDialog = ({ canResetKey, onDone }: { canResetKey: boolean; onDone: () => void }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, afterwards: (result: unknown) => void) => {
    setBusy(true);
    setError(null);
    try {
      afterwards(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Frame title="The local encryption key is not available">
      <p className="shrink-0">
        {canResetKey
          ? 'Insomnia could not use the key that protects the sensitive fields (passwords, tokens, cookie values and similar) in its local database. This may happen if the application data was moved from another machine or the OS credential store was reset.'
          : 'Insomnia could not create the key that protects the sensitive fields (passwords, tokens, cookie values and similar) in its local database. This may happen if the OS credential store is not available.'}
      </p>
      <p className="shrink-0">
        For this session, values that are already encrypted do not work, and values you enter are stored without
        encryption until the key is available again. Nothing is deleted. The next time Insomnia starts, it tries again.
      </p>
      {canResetKey && (
        <p className="shrink-0">
          If the key will never be available again, you can <strong>reset the local encryption key</strong>: the
          encrypted values are given up and Insomnia starts over with a new key. You are asked to confirm first.
        </p>
      )}
      <ErrorMessage error={error} />
      <div className="flex shrink-0 items-center justify-end gap-2">
        {canResetKey && (
          <Button
            data-testid="field-encryption-reset-key"
            className={secondaryButtonClassName}
            isDisabled={busy}
            onPress={() =>
              run(
                () => fieldEncryption.resetKey(),
                // The app restarts when the user confirmed. If they declined, nothing happened.
                confirmed => !confirmed && setBusy(false),
              )
            }
          >
            Reset local encryption key
          </Button>
        )}
        <Button
          data-testid="field-encryption-continue"
          className={primaryButtonClassName}
          isDisabled={busy}
          onPress={() => run(() => fieldEncryption.dismiss(), onDone)}
        >
          Continue
        </Button>
      </div>
    </Frame>
  );
};

/**
 * Tells the user when the encrypted fields of the local database cannot be used: either the key is not available
 * (degraded mode) or some fields could not be decrypted. It asks the main process once when it is mounted and shows
 * nothing when there is nothing to tell.
 */
export const FieldEncryptionIssueModal = () => {
  const [status, setStatus] = useState<FieldEncryptionStatus>({ kind: 'ok' });

  useEffect(() => {
    let isCurrent = true;
    fieldEncryption
      .getStatus()
      .then(result => isCurrent && setStatus(result))
      .catch(error => {
        // Saying nothing would leave the user believing that the encrypted fields work
        console.error('[field-encryption] Could not read the status', error);
        if (isCurrent) {
          showError({
            title: 'Could not read the encryption status of the local database',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const close = () => setStatus({ kind: 'ok' });

  if (status.kind === 'degraded') {
    return <DegradedDialog canResetKey={status.canResetKey} onDone={close} />;
  }
  if (status.kind === 'decryptionFailed') {
    return <DecryptionFailedDialog failures={status.failures} onDone={close} />;
  }
  return null;
};
