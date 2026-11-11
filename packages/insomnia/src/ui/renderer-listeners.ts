import { services } from 'insomnia-data';

import type { NativeSignInStatus } from '~/sync/git/providers/native';
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
