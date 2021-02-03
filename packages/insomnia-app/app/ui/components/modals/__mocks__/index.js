// eslint-disable-next-line filenames/match-exported
const modals = jest.requireActual('../index');

modals.showError = jest.fn();
modals.showAlert = jest.fn();
modals.showPrompt = jest.fn();
modals.showModal = jest.fn();

module.exports = modals;
