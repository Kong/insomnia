const EVENT_TO_ACTION = {
  insert: 'insert',
  update: 'update',
  remove: 'remove'
};


/**
 * Build a change object
 *
 * @param event
 * @param doc
 * @returns {{action: *, doc: *}}
 */
export function buildChange (event, doc) {
  const action = EVENT_TO_ACTION[event];
  return {action, doc};
}
