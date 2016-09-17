const modals = {};

export function addModal (instance) {
  if (instance === null) {
    // Modal was unmounted
    return
  }
  modals[instance.constructor.name] = instance;
}

export function getModal (modalCls) {
  return modals[modalCls.name];
}
