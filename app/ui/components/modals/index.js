import PromptModal from './prompt-modal';
import AlertModal from './alert-modal';

const modals = {};

export function registerModal (instance) {
  if (instance === null) {
    // Modal was unmounted
    return;
  }
  modals[instance.constructor.name] = instance;
}

export function showPrompt (config) {
  showModal(PromptModal, config);
}

export function showAlert (config) {
  showModal(AlertModal, config);
}

export function showModal (modalCls, ...args) {
  return _getModal(modalCls).show(...args);
}

export function toggleModal (modalCls, ...args) {
  return _getModal(modalCls).toggle(...args);
}

export function hideModal (modalCls) {
  return _getModal(modalCls).hide();
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
