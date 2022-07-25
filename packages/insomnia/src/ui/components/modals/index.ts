import { trackPageView } from '../../../common/analytics';
import { AlertModal, AlertModalOptions } from './alert-modal';
import { ErrorModal, ErrorModalOptions } from './error-modal';
import { PromptModal, PromptModalOptions } from './prompt-modal';

const modals: Record<string, any> = {};
export interface ModalHandle {
  hide(): void;
  show(): void;
}

export function registerModal(instance: any, modalName?: string) {
  if (instance === null) {
    // Modal was unmounted
    return;
  }

  modals[modalName ?? instance.constructor.name] = instance;
}

export function showModal(modalCls: any, ...args: any[]) {
  trackPageView(modalCls.name);
  return _getModal(modalCls).show(...args);
}

export function showPrompt(config: PromptModalOptions) {
  return showModal(PromptModal, config);
}

export function showAlert(config: AlertModalOptions) {
  return showModal(AlertModal, config);
}

export function showError(config: ErrorModalOptions) {
  try {
    return showModal(ErrorModal, config);
  } catch (err) {
    console.log('[modal] Cannot show modal', err, config);
  }
}

export function hideAllModals() {
  for (const key of Object.keys(modals)) {
    const modal = modals[key];
    modal.hide?.();
  }
}

function _getModal(modalCls: any) {
  const m = modals[modalCls.name || modalCls.WrappedComponent?.name || modalCls.displayName];

  if (!m) {
    throw new Error('Modal was not registered with the app');
  }

  return m;
}
