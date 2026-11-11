import type { KeyObject } from 'node:crypto';

import { app, BrowserWindow, dialog, type MessageBoxOptions, type WebContents } from 'electron';
import { exportFieldEncryptionKey, type FieldEncryptionKeyExport } from 'insomnia-data/node';

import { setAsideLocalEncryptionKey } from '../local-encryption-key';
import { BaseIpcHandler } from './base-ipc-handler';

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

interface DocumentSummary {
  name?: unknown;
}

export interface FieldEncryptionControllerDeps {
  /** The key the database was opened with. Undefined when it was opened without encryption (degraded mode). */
  key: KeyObject | undefined;
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
        const fallback = `${type} ${_id}`;
        labels.set(
          documentKey,
          // Documents such as a stored OAuth 2 token have no name of their own: what the user knows them by is the
          // request they belong to. The name only helps the user, so when it cannot be found, the dialog still lists the
          // field under its type and id: failing here would hide the problem instead.
          deps
            .findDocumentWithAncestors(type, _id)
            .then(docs => docs.map(getName).find(Boolean) ?? fallback)
            .catch(error => {
              console.error(`[field-encryption] Could not look up the name of ${fallback}`, error);
              return fallback;
            }),
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
      if (!deps.key) {
        return { kind: 'degraded', canResetKey: deps.keyFileExists() };
      }
      const failures = await deps.refreshFailures();
      if (failures.length === 0) {
        return { kind: 'ok' };
      }
      return { kind: 'decryptionFailed', failures: await describeFailures(failures) };
    },

    resetFailedFields: async () => {
      if (!deps.key) {
        throw new Error('Fields cannot be reset while the database runs without encryption');
      }
      const cleared = await deps.resetFailures();
      decided = true;
      return cleared;
    },

    resetKey: async (sender?: WebContents) => {
      if (deps.key) {
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

    /** Whether there is a key to give out. Does not reveal it. */
    isKeyAvailable: async () => !!deps.key,

    /** The key in both forms the user can hand to other tools. Rejects when this session has no key. */
    getKey: async (): Promise<FieldEncryptionKeyExport> => {
      if (!deps.key) {
        throw new Error('There is no local encryption key in this session');
      }
      return exportFieldEncryptionKey(deps.key);
    },
  };
};

type FieldEncryptionController = ReturnType<typeof createFieldEncryptionController>;

// The handler is registered when the app is ready, but the controller needs the database, which is opened after that.
// Kept outside the handler class on purpose: the IPC dispatcher calls any method of a registered handler for the
// renderer, so everything on the class has to be API, and this setter is not.
let controller: FieldEncryptionController | undefined;

/** Gives the handler the controller of the main database. Called when the database has been opened. */
export const provideFieldEncryptionController = (provided: FieldEncryptionController) => {
  controller = provided;
};

const getController = () => {
  if (!controller) {
    throw new Error('The encryption status of the local database is not available yet');
  }
  return controller;
};

/**
 * What the renderer may ask about the encryption of the local database, reached as `fieldEncryption` from `ui/ipc.ts`.
 * Every method here can be called by the renderer, so this class must hold nothing else.
 */
export class FieldEncryptionIpcHandler extends BaseIpcHandler {
  channel = 'fieldEncryption';

  getStatus(_: WebContents) {
    return getController().getStatus();
  }

  /** Clears the fields that could not be decrypted. Resolves the number of fields that were cleared. */
  resetFailedFields(_: WebContents) {
    return getController().resetFailedFields();
  }

  /**
   * Asks the user to confirm in a native dialog, then sets the local encryption key aside and restarts the app, which
   * then creates a new key. Only in degraded mode, and only when there is a key file. Resolves false when the user
   * declined, and does not resolve when the app restarts.
   */
  resetKey(sender: WebContents) {
    return getController().resetKey(sender);
  }

  /** The user chose to continue as is: the dialog is not shown again until the app is restarted. */
  dismiss(_: WebContents) {
    return getController().dismiss();
  }

  /** Whether this session has a local encryption key that can be copied or exported. Does not reveal the key. */
  isKeyAvailable(_: WebContents) {
    return getController().isKeyAvailable();
  }

  /**
   * The local encryption key as JWK JSON text and as its base64, for the user to copy or save. Only called when the user
   * asks for the key. Rejects in degraded mode, where there is no key.
   */
  getKey(_: WebContents) {
    return getController().getKey();
  }
}

export const fieldEncryptionIpcHandler = new FieldEncryptionIpcHandler();

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
