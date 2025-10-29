import { invariant } from '../../../utils/invariant';
import { ErrorModal, type ErrorModalOptions } from './error-modal';

interface ModalHandle {
  show: (options: any) => void;
  hide: () => void;
}

const modals: Record<string, ModalHandle> = {};

export function registerModal(instance: any, modalName?: string) {
  if (instance === null) {
    // Modal was unmounted
    return;
  }

  modals[modalName ?? instance.constructor.name] = instance;
}

export function showModal(modalComponent: any, config?: any) {
  const name = modalComponent.name || modalComponent.displayName;
  invariant(name, 'Modal must have a name or displayName');
  window.main.trackPageView({ name });

  const modalHandle = getModalComponentHandle(name);

  modalHandle.show(config);
  return () => {
    const modalHandle = getModalComponentHandle(name);
    if (modalHandle) {
      modalHandle.hide();
    }
  };
}

export function showError(config: ErrorModalOptions) {
  try {
    showModal(ErrorModal, config);
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

function getModalComponentHandle(name: string) {
  const modalComponentRef = modals[name];
  invariant(modalComponentRef, `Modal ${name} not found`);

  return modalComponentRef;
}
