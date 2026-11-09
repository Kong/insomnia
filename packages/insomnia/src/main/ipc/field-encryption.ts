import { app, BrowserWindow, dialog, type MessageBoxOptions, type WebContents } from 'electron';

import { setAsideLocalEncryptionKey } from '../local-encryption-key';
import { ipcMainHandle } from './electron';

/** A field of a document that holds encrypted data which could not be decrypted. */
export interface FieldEncryptionFailure {
  type: string;
  _id: string;
  /** Concrete path inside the document, e.g. `authentication.password` or `cookies[1].value`. */
  path: string;
  /** What the user knows the document by: its name, or the name of the document it belongs to. */
  label: string;
}

/** What the renderer shows to the user, if anything, about the encryption of the local database. */
export type FieldEncryptionStatus =
  /** Nothing to tell, or the user has already decided what to do during this run of the app. */
  | { kind: 'ok' }
  /**
   * The local encryption key could not be used, so the database runs without encryption. `canResetKey` is whether there is
   * a key file to set aside: without one (the key could not be created on the first launch) a reset would change nothing.
   */
  | { kind: 'degraded'; canResetKey: boolean }
  /** The key works, but these fields were encrypted with another key or are damaged. */
  | { kind: 'decryptionFailed'; failures: FieldEncryptionFailure[] };

export interface fieldEncryptionBridgeAPI {
  getStatus: () => Promise<FieldEncryptionStatus>;
  /** Clears the fields that could not be decrypted. Resolves the number of fields that were cleared. */
  resetFailedFields: () => Promise<number>;
  /**
   * Asks the user to confirm in a native dialog, then sets the local encryption key aside and restarts the app, which
   * then creates a new key. Only in degraded mode, and only when there is a key file. Resolves false when the user
   * declined, and does not resolve when the app restarts.
   */
  resetKey: () => Promise<boolean>;
  /** The user chose to continue as is: the dialog is not shown again until the app is restarted. */
  dismiss: () => Promise<void>;
}

interface DocumentSummary {
  name?: unknown;
}

export interface FieldEncryptionControllerDeps {
  /** True when the database was opened without the local encryption key. */
  degraded: boolean;
  /** The fields that still hold ciphertext that could not be decrypted, checked against the current data. */
  refreshFailures: () => Promise<{ type: string; _id: string; path: string }[]>;
  resetFailures: () => Promise<number>;
  /** The document followed by its ancestors, nearest first; empty when it does not exist. */
  findDocumentWithAncestors: (type: string, _id: string) => Promise<DocumentSummary[]>;
  /** Whether there is a key file that could be set aside. */
  keyFileExists: () => boolean;
  /** Asks the user, outside the renderer, whether to give up the encrypted values. Resolves true when they agree. */
  confirmResetKey: (sender?: WebContents) => Promise<boolean>;
  setAsideKey: () => Promise<unknown>;
  restart: () => void;
}

const getName = (doc: DocumentSummary) =>
  typeof doc.name === 'string' && doc.name.trim() !== '' ? doc.name : undefined;

export const createFieldEncryptionController = (deps: FieldEncryptionControllerDeps) => {
  // Set once the user has decided; it keeps the dialog from coming back in another window or after a reload
  let decided = false;

  // A document with several failed fields is looked up once
  const describeFailures = async (failures: { type: string; _id: string; path: string }[]) => {
    const labels = new Map<string, Promise<string>>();
    const getLabel = ({ type, _id }: { type: string; _id: string }) => {
      const documentKey = JSON.stringify([type, _id]);
      if (!labels.has(documentKey)) {
        labels.set(
          documentKey,
          // Documents such as a stored OAuth 2 token have no name of their own: what the user knows them by is the
          // request they belong to
          deps.findDocumentWithAncestors(type, _id).then(docs => docs.map(getName).find(Boolean) ?? `${type} ${_id}`),
        );
      }
      return labels.get(documentKey)!;
    };
    return Promise.all(
      failures.map(
        async (failure): Promise<FieldEncryptionFailure> => ({ ...failure, label: await getLabel(failure) }),
      ),
    );
  };

  return {
    getStatus: async (): Promise<FieldEncryptionStatus> => {
      if (decided) {
        return { kind: 'ok' };
      }
      if (deps.degraded) {
        return { kind: 'degraded', canResetKey: deps.keyFileExists() };
      }
      const failures = await deps.refreshFailures();
      if (failures.length === 0) {
        return { kind: 'ok' };
      }
      return { kind: 'decryptionFailed', failures: await describeFailures(failures) };
    },

    resetFailedFields: async () => {
      if (deps.degraded) {
        throw new Error('Fields cannot be reset while the database runs without encryption');
      }
      const cleared = await deps.resetFailures();
      decided = true;
      return cleared;
    },

    resetKey: async (sender?: WebContents) => {
      if (!deps.degraded) {
        throw new Error('The encryption key can only be reset when it could not be used');
      }
      if (!deps.keyFileExists()) {
        throw new Error('There is no encryption key file to reset');
      }
      // The renderer cannot answer this for the user: the question is asked by the main process
      if (!(await deps.confirmResetKey(sender))) {
        return false;
      }
      await deps.setAsideKey();
      deps.restart();
      return true;
    },

    dismiss: async () => {
      decided = true;
    },
  };
};

export const registerFieldEncryptionHandlers = (controller: ReturnType<typeof createFieldEncryptionController>) => {
  ipcMainHandle('fieldEncryption.getStatus', () => controller.getStatus());
  ipcMainHandle('fieldEncryption.resetFailedFields', () => controller.resetFailedFields());
  ipcMainHandle('fieldEncryption.resetKey', event => controller.resetKey(event.sender));
  ipcMainHandle('fieldEncryption.dismiss', () => controller.dismiss());
};

const CANCEL = 0;

/**
 * Asks the user, in a native dialog that the renderer cannot answer or skip, to confirm giving up every value that is
 * already encrypted. The default and the Esc key are Cancel.
 */
export const confirmLocalKeyReset = async (
  sender?: WebContents,
  showMessageBox: (window: BrowserWindow | null, options: MessageBoxOptions) => Promise<{ response: number }> = (
    window,
    options,
  ) => (window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)),
) => {
  const options: MessageBoxOptions = {
    type: 'warning',
    title: 'Reset the local encryption key?',
    message: 'Reset the local encryption key?',
    detail:
      'All values that are already encrypted (passwords, tokens, cookie values and similar) will become unreadable for ' +
      'good, and you will need to enter them again. Insomnia will restart and create a new key.\n\n' +
      'The old key file is not deleted: it is kept with ".bak" in its name, in case you want to put it back.',
    buttons: ['Cancel', 'Reset Key and Restart'],
    defaultId: CANCEL,
    cancelId: CANCEL,
    noLink: true,
  };
  const { response } = await showMessageBox(sender ? BrowserWindow.fromWebContents(sender) : null, options);
  return response !== CANCEL;
};

export const restartApp = () => {
  app.relaunch();
  app.exit();
};

export const setAsideKey = () => setAsideLocalEncryptionKey();
