/* global require, process, setTimeout */
// Preloaded into the app's main process (see `preloadScripts` in launch.ts) by specs that need to drive the app's
// native dialogs, which Playwright cannot click and which can already be on screen before it connects.
//
// It answers `dialog.showMessageBox` from a fixed list of button indexes and records what it was asked, and it makes
// `shell.openPath` record the path instead of opening a file manager. Everything is reported to a JSON-lines file:
//   INSOMNIA_TEST_NATIVE_DIALOG_LOG        file to append to (required)
//   INSOMNIA_TEST_NATIVE_DIALOG_RESPONSES  comma-separated button indexes to answer with, in order (default: 0)
//   INSOMNIA_TEST_NATIVE_DIALOG_DELAY_MS   how long each dialog stays "open" before it is answered (default: 0)
const fs = require("node:fs");

const { dialog, shell } = require("electron");

const log = process.env.INSOMNIA_TEST_NATIVE_DIALOG_LOG;
const responses = (process.env.INSOMNIA_TEST_NATIVE_DIALOG_RESPONSES ?? "")
  .split(",")
  .filter((value) => value !== "")
  .map(Number);
const delayMs = Number(process.env.INSOMNIA_TEST_NATIVE_DIALOG_DELAY_MS ?? 0);

const record = (entry) => fs.appendFileSync(log, `${JSON.stringify(entry)}\n`);

dialog.showMessageBox = async (...args) => {
  const options = args.at(-1);
  record({
    kind: "messageBox",
    type: options.type,
    title: options.title,
    message: options.message,
    detail: options.detail,
    buttons: options.buttons,
  });
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const response = responses.shift() ?? 0;
  record({ kind: "answer", response });
  return { response, checkboxChecked: false };
};

shell.openPath = async (target) => {
  record({ kind: "openPath", path: target });
  return "";
};
