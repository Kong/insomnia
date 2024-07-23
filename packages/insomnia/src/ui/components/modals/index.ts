import { invariant } from '../../../utils/invariant';
import type { ModalProps } from '../base/modal';
import { AlertModal, type AlertModalOptions } from './alert-modal';
import { ErrorModal, type ErrorModalOptions } from './error-modal';
import { PromptModal, type PromptModalOptions } from './prompt-modal';

interface ModalHandle {
  show:(options: any) => void;
  hide:() => void;
}

const modals: Record<string, ModalHandle> = {};

export function registerModal(instance: any, modalName?: string) {
  if (instance === null) {
    // Modal was unmounted
    return;
  }

  modals[modalName ?? instance.constructor.name] = instance;
}

type GetRefHandleFromProps<Props> = Props extends React.RefAttributes<infer TModalHandle> ? TModalHandle : never;

type ModalComponent<TModalProps> = React.ForwardRefExoticComponent<TModalProps & React.RefAttributes<GetRefHandleFromProps<TModalProps>>>;

type ModalHandleShowOptions<TModalHandle> = TModalHandle extends {
  show: (options: infer TOptions) => void;
} ? TOptions : any;

export function showModal<TModalProps extends ModalProps & React.RefAttributes<{
  show:(options: any) => void;
}>>(
  modalComponent: ModalComponent<TModalProps>, config?: ModalHandleShowOptions<GetRefHandleFromProps<TModalProps>>,
) {
  const name = modalComponent.name || modalComponent.displayName;
  invariant(name, 'Modal must have a name or displayName');
  window.main.trackPageView({ name });

  const modalHandle = getModalComponentHandle(name) as unknown as GetRefHandleFromProps<TModalProps>;

  return modalHandle.show(config);
}

export function showPrompt(options: PromptModalOptions) {
  return showModal(PromptModal, options);
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

function getModalComponentHandle(name: string) {
  const modalComponentRef = modals[name];
  invariant(modalComponentRef, `Modal ${name} not found`);

  return modalComponentRef;
}
