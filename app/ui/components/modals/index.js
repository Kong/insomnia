import PromptModal from './prompt-modal';
import AlertModal from './alert-modal';
import ErrorModal from './error-modal';

const modals = {};

export function registerModal (instance) {
  if (instance === null) {
    // Modal was unmounted
    return;
  }
  modals[instance.constructor.name] = instance;
}

export function showPrompt (config) {
  return showModal(PromptModal, config);
}

export function showAlert (config) {
  return showModal(AlertModal, config);
}

export function showError (config) {
  return showModal(ErrorModal, config);
}

export function showModal (modalCls, ...args) {
  return _getModal(modalCls).show(...args);
}

export function hideAllModals () {
  for (const key of Object.keys(modals)) {
    const modal = modals[key];
    modal.hide && modal.hide();
  }
}

function _getModal (modalCls) {
  return modals[modalCls.name];
}
