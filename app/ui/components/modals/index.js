const modals = {};

export function registerModal (instance) {
  if (instance === null) {
    // Modal was unmounted
    return
  }
  modals[instance.constructor.name] = instance;
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

function _getModal (modalCls) {
  return modals[modalCls.name];
}
