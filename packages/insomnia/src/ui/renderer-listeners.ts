import { services } from 'insomnia-data';

import type { NativeCredentialError, NativeSignInStatus } from '~/sync/git/providers/native';
import { queue, type RAToastContent, showToast } from '~/ui/components/toast-notification';
import { git } from '~/ui/ipc';
import * as themes from '~/ui/plugins/misc';
import { plugins } from '~/ui/plugins/renderer-bridge';
import * as templating from '~/ui/templating/renderer-safe';

import { dispatchEditorUndo } from './components/.client/codemirror/editor-undo';
import { showModal } from './components/modals';
import { SettingsModal } from './components/modals/settings-modal';

// Edit-menu Undo/Redo route here so one handler reconciles CodeMirror's history
// with the native undo stack based on what's focused (see editor-undo.ts).
window.main.on('edit:undo', () => dispatchEditorUndo('undo'));
window.main.on('edit:redo', () => dispatchEditorUndo('redo'));

window.main.on('toggle-preferences', () => {
  showModal(SettingsModal);
});

window.main.on('reload-plugins', async () => {
  const settings = await services.settings.get();
  await plugins.reloadPlugins();
  await themes.applyColorScheme(settings);
  templating.reload();
  console.log('[plugins] reloaded');
});

window.main.on('toggle-preferences-shortcuts', () => {
  showModal(SettingsModal, { tab: 'keyboard' });
});

window.main.on('show-toast', (_, options: { content: RAToastContent; options?: { timeout?: number } }) => {
  showToast(options.content, options.options);
});

// Toasts for System Git Credentials sign-ins that are waiting for the user, keyed by sign-in id.
const nativeSignInToasts = new Map<string, string>();

window.main.on('git.native-sign-in-status', (_, status: NativeSignInStatus) => {
  if (status.state === 'pending') {
    const key = showToast(
      {
        icon: 'key',
        title: 'Waiting for your git credential manager',
        description: `Your system git credential manager is handling credentials for ${status.host}. If a sign-in window or browser tab opened, complete the sign-in there.`,
        status: 'info',
        action: {
          label: 'Cancel sign-in',
          onPress: () => git.cancelNativeSignIn(status.id),
        },
      },
      { timeout: null },
    );
    nativeSignInToasts.set(status.id, key);
    return;
  }

  const key = nativeSignInToasts.get(status.id);
  nativeSignInToasts.delete(status.id);
  if (key) {
    queue.close(key);
  }

  if (status.state === 'timeout') {
    showToast(
      {
        icon: 'key',
        title: 'Git sign-in timed out',
        description: `Insomnia stopped waiting for the sign-in to ${status.host}. Try the git operation again.`,
        status: 'warning',
      },
      { timeout: 8000 },
    );
  }
});

window.main.on('plugins.uiAlert', (_, options: Record<string, any>) => {
  window.showAlert?.(options);
});

window.main.on('plugins.uiDialog', (_, options: Record<string, any>) => {
  window.showWrapper?.(options);
});

window.main.on('ui.prompt', (_, id: string, options: Record<string, any>) => {
  window.showPrompt?.({
    ...options,
    onComplete: (value: string) => {
      window.main.notifyPromptResult(id, value);
    },
    onHide: () => {
      window.main.notifyPromptResult(id, null);
    },
  });
});

const nativeCredentialErrorMessages: Record<NativeCredentialError['reason'], (host: string) => RAToastContent> = {
  'git-not-found': () => ({
    title: 'Git not found',
    description: 'System Git Credentials uses the git installed on this computer. Install git, then try again.',
  }),
  'no-credentials': host => ({
    title: 'No git credentials found',
    description: `Your system git credential manager has no credentials for ${host}. Install Git Credential Manager to sign in from Insomnia, or use an Access Token credential instead.`,
  }),
  'rejected': host => ({
    title: 'Git credentials rejected',
    description: `${host} rejected the credentials from your system git credential manager. Update them in your credential manager, or use an Access Token credential instead.`,
  }),
};

window.main.on('git.native-credential-error', (_, error: NativeCredentialError) => {
  const content = nativeCredentialErrorMessages[error.reason](error.host);
  showToast(
    {
      ...content,
      icon: 'key',
      status: 'warning',
      description: error.detail ? `${content.description} (${error.detail})` : content.description,
    },
    { timeout: null },
  );
});
